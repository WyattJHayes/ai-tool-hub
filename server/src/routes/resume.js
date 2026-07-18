import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { LLMService } from '../services/llm.js';
import { quotaService } from '../services/quota.js';
import logger from '../utils/logger.js';

const router = Router();
const llmService = new LLMService();

const MAX_RESUME_LENGTH = 50000;
const MAX_JD_LENGTH = 10000;

router.post('/optimize', authMiddleware, async (req, res) => {
    const { level, resumeText, jobDescription } = req.body;

    if (!level || !resumeText) {
        return res.status(400).json({ error: '缺少必要参数: level 和 resumeText' });
    }

    if (!['light', 'medium', 'deep'].includes(level)) {
        return res.status(400).json({ error: '无效的优化级别，可选: light, medium, deep' });
    }

    if (resumeText.length > MAX_RESUME_LENGTH) {
        return res.status(400).json({ error: '简历文本过长，最多支持50000个字符' });
    }

    if (jobDescription && jobDescription.length > MAX_JD_LENGTH) {
        return res.status(400).json({ error: '职位描述过长，最多支持10000个字符' });
    }

    if (level !== 'light' && !jobDescription) {
        return res.status(400).json({ error: '中度和深度优化需要提供目标职位描述（JD）' });
    }

    const reservation = quotaService.tryConsumeQuota(req.user.id);
    if (!reservation.allowed) {
        return res.status(429).json({
            error: '今日优化次数已用完',
            quota: reservation.quota
        });
    }

    logger.info(`Resume optimize started: user=${req.user.id}, level=${level}`);
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const SSE_TIMEOUT = 60000;
    req.setTimeout(SSE_TIMEOUT);
    res.setTimeout(SSE_TIMEOUT);

    let quotaCommitted = false;
    let quotaReleased = false;
    const releaseQuota = () => {
        if (quotaCommitted || quotaReleased) return;
        quotaReleased = true;
        quotaService.refundUsage(req.user.id);
    };
    const connectionStart = Date.now();
    let timeoutHandle = setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
            releaseQuota();
            sendSSE('error', { message: '连接超时，配额未扣除，请稍后重试' });
            logger.warn(`SSE timeout: user=${req.user.id}, duration=${Date.now() - connectionStart}ms, quotaCommitted=${quotaCommitted}`);
            res.end();
        }
    }, SSE_TIMEOUT);

    const sendSSE = (type, data) => {
        try {
            res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
            // client disconnected
        }
    };

    let aborted = false;
    req.on('aborted', () => {
        aborted = true;
        clearTimeout(timeoutHandle);
        releaseQuota();
        logger.info(`Client disconnected: user=${req.user.id}, duration=${Date.now() - connectionStart}ms`);
    });
    res.on('close', () => {
        if (!res.writableEnded) {
            aborted = true;
            clearTimeout(timeoutHandle);
            releaseQuota();
        }
    });

    try {
        const generator = llmService.streamOptimize(level, resumeText, jobDescription || '');

        for await (const event of generator) {
            if (res.writableEnded || res.destroyed || aborted) break;

            if (event.type === 'progress') {
                sendSSE('progress', event.data);
            } else if (event.type === 'token') {
                sendSSE('token', event.data);
            } else if (event.type === 'done') {
                quotaCommitted = true;
                sendSSE('done', {
                    ...event.data,
                    quotaRemaining: reservation.quota.remaining
                });
                logger.info(`Resume optimize completed: user=${req.user.id}, level=${level}, duration=${Date.now() - connectionStart}ms`);
            }
        }
    } catch (error) {
        releaseQuota();
        logger.error(`Resume optimize error: user=${req.user.id}`, error);
        sendSSE('error', { message: error.message || 'AI优化服务暂时不可用，请稍后重试' });
    }

    if (!quotaCommitted) releaseQuota();

    clearTimeout(timeoutHandle);

    if (!res.writableEnded) {
        res.end();
    }
});

router.post('/parse', authMiddleware, async (req, res) => {
    const { text } = req.body;

    if (!text || text.trim().length < 10) {
        return res.status(400).json({ error: '缺少简历文本或文本过短' });
    }

    if (text.length > MAX_RESUME_LENGTH) {
        return res.status(400).json({ error: `文本过长，最多支持${MAX_RESUME_LENGTH}个字符` });
    }

    const reservation = quotaService.tryConsumeQuota(req.user.id);
    if (!reservation.allowed) {
        return res.status(429).json({
            error: '今日使用次数已用完',
            quota: reservation.quota
        });
    }

    try {
        const result = await llmService.parseResumeText(text);
        logger.info(`Resume parsed: user=${req.user.id}, textLength=${text.length}`);
        res.json(result);
    } catch (error) {
        quotaService.refundUsage(req.user.id);
        logger.error(`Resume parse error: user=${req.user.id}`, error);
        if (error.message && (error.message.includes('not configured') || error.message.includes('Insufficient'))) {
            return res.status(503).json({ error: error.message, fallback: true });
        }
        res.status(500).json({ error: '简历解析失败，请稍后重试' });
    }
});

router.post('/analyze-jd', authMiddleware, async (req, res) => {
    const { jdText } = req.body;

    if (!jdText) {
        return res.status(400).json({ error: '缺少JD文本' });
    }

    if (jdText.length > MAX_JD_LENGTH) {
        return res.status(400).json({ error: `JD文本过长，最多支持${MAX_JD_LENGTH}个字符` });
    }

    const reservation = quotaService.tryConsumeQuota(req.user.id);
    if (!reservation.allowed) {
        return res.status(429).json({
            error: '今日使用次数已用完',
            quota: reservation.quota
        });
    }

    try {
        const result = await llmService.analyzeJD(jdText);
        logger.info(`JD analyzed: user=${req.user.id}, jdLength=${jdText.length}`);
        res.json(result);
    } catch (error) {
        quotaService.refundUsage(req.user.id);
        logger.error(`JD analyze error: user=${req.user.id}`, error);
        res.status(500).json({ error: 'JD分析失败，请稍后重试' });
    }
});

export default router;
