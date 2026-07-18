-- AI Tool Hub Database Schema
-- Run this in Supabase SQL Editor

-- 工具表
CREATE TABLE tools (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url VARCHAR(500),
    website_url VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    categories JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    tool_tags JSONB DEFAULT '[]'::jsonb,
    pricing JSONB DEFAULT '[]'::jsonb,
    value_tag VARCHAR(50),
    highlights JSONB DEFAULT '[]'::jsonb,
    is_domestic BOOLEAN DEFAULT false,
    requires_login BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    click_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    difficulty VARCHAR(20),
    status VARCHAR(20) DEFAULT 'stable',
    icon VARCHAR(50),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 分类表
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0
);

-- 场景表
CREATE TABLE scenes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    icon VARCHAR(50),
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE scene_tools (
    scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
    tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (scene_id, tool_id)
);

-- 用户扩展表
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 收藏
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tool_id)
);

-- 评分（增强版：+ 标签 + 短评）
CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
    score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
    tags JSONB DEFAULT '[]'::jsonb,
    comment VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tool_id)
);

-- 点击日志
CREATE TABLE click_logs (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
    tool_slug VARCHAR(100),
    from_page VARCHAR(50),
    from_section VARCHAR(100),
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 策略
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view ratings" ON ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 触发器：评分自动更新工具平均分
CREATE OR REPLACE FUNCTION update_tool_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tools SET
        avg_rating = (SELECT COALESCE(AVG(score), 0) FROM ratings WHERE tool_id = COALESCE(NEW.tool_id, OLD.tool_id)),
        rating_count = (SELECT COUNT(*) FROM ratings WHERE tool_id = COALESCE(NEW.tool_id, OLD.tool_id)),
        updated_at = now()
    WHERE id = COALESCE(NEW.tool_id, OLD.tool_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_rating
AFTER INSERT OR UPDATE OR DELETE ON ratings
FOR EACH ROW EXECUTE FUNCTION update_tool_rating();

-- 触发器：收藏数自动更新
CREATE OR REPLACE FUNCTION update_tool_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tools SET favorite_count = favorite_count + 1 WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tools SET favorite_count = favorite_count - 1 WHERE id = OLD.tool_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_favorite_count
AFTER INSERT OR DELETE ON favorites
FOR EACH ROW EXECUTE FUNCTION update_tool_favorite_count();

-- 公开只读策略 for tools, categories, scenes
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tools" ON tools FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read scenes" ON scenes FOR SELECT USING (true);
CREATE POLICY "Public read click_logs" ON click_logs FOR SELECT USING (true);
CREATE POLICY "Public insert click_logs" ON click_logs FOR INSERT WITH CHECK (true);

-- 自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
