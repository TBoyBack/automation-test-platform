/**
 * API 路由 - 测试用例管理
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// ============ 用例管理 ============

/**
 * 获取用例列表
 * GET /api/v1/cases
 */
router.get('/cases', async (req, res) => {
  try {
    const { project_id, suite_id, type, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT id, suite_id, name, description, type, created_by, created_at, updated_at
      FROM test_case
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (project_id) {
      query += ` AND suite_id IN (
        SELECT id FROM test_suite WHERE project_id = $${paramIndex}
      )`;
      params.push(project_id);
      paramIndex++;
    }
    
    if (suite_id) {
      query += ` AND suite_id = $${paramIndex}`;
      params.push(suite_id);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    // 分页
    const offset = (page - 1) * limit;
    query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('获取用例列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 获取用例详情
 * GET /api/v1/cases/:id
 */
router.get('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM test_case WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('获取用例详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 创建用例
 * POST /api/v1/cases
 */
router.post('/cases', async (req, res) => {
  try {
    const { suite_id, name, description, type, content } = req.body;
    
    if (!suite_id || !name || !type || !content) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必填字段' 
      });
    }
    
    const result = await db.query(
      `INSERT INTO test_case (suite_id, name, description, type, content, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [suite_id, name, description, type, content, req.user?.id || 'system']
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('创建用例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 更新用例
 * PUT /api/v1/cases/:id
 */
router.put('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, content } = req.body;
    
    const result = await db.query(
      `UPDATE test_case 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           content = COALESCE($4, content),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, description, type, content !== undefined ? content : null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('更新用例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 删除用例
 * DELETE /api/v1/cases/:id
 */
router.delete('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM test_case WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    
    res.json({ success: true, message: '用例已删除' });
  } catch (error) {
    console.error('删除用例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 执行单个用例
 * POST /api/v1/cases/:id/run
 */
router.post('/cases/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id, params } = req.body;
    
    // 获取用例详情
    const caseResult = await db.query(
      'SELECT * FROM test_case WHERE id = $1',
      [id]
    );
    
    if (caseResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用例不存在' });
    }
    
    // 获取套件信息
    await db.query(
      'SELECT * FROM test_suite WHERE id = $1',
      [caseResult.rows[0].suite_id]
    );
    
    // 创执行记录
    const executionResult = await db.query(
      `INSERT INTO test_execution (suite_id, device_id, status, start_time, created_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       RETURNING id`,
      [caseResult.rows[0].suite_id, device_id]
    );
    
    // TODO: 将任务加入执行队列
    // const executor = require('../services/executor');
    // executor.submitJob(executionId, caseResult.rows[0], device_id);
    
    res.json({ 
      success: true, 
      message: '执行任务已创建',
      data: { execution_id: executionResult.rows[0].id }
    });
  } catch (error) {
    console.error('执行用例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
