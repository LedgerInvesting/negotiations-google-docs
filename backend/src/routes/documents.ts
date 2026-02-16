import { Router } from 'express';
import { z } from 'zod';
import { DocumentModel } from '../models/document';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createDocumentSchema = z.object({
  title: z.string().optional(),
  initialContent: z.string().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, {
  message: "At least one of title or content must be provided",
});

const getDocumentsSchema = z.object({
  search: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

const getByIdsSchema = z.object({
  ids: z.array(z.number()),
});

// GET /api/documents - Get paginated documents
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { search, limit = '5', cursor = '0' } = getDocumentsSchema.parse(req.query);
    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;

    const result = await DocumentModel.getPaginated(
      userId,
      organizationId,
      search,
      parseInt(limit),
      parseInt(cursor)
    );

    res.json({
      page: result.documents,
      isDone: !result.hasMore,
      continueCursor: result.continueCursor,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/documents - Create a new document
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, initialContent } = createDocumentSchema.parse(req.body);
    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;

    const document = await DocumentModel.create({
      title,
      initial_content: initialContent,
      owner_id: userId,
      organization_id: organizationId,
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// GET /api/documents/:id - Get a single document
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await DocumentModel.getById(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/documents/by-ids - Get multiple documents by IDs
router.post('/by-ids', async (req: AuthRequest, res) => {
  try {
    const { ids } = getByIdsSchema.parse(req.body);
    
    const documents = await DocumentModel.getByIds(ids);
    const documentMap = new Map(documents.map(doc => [doc.id, doc]));
    
    const result = ids.map(id => {
      const doc = documentMap.get(id);
      return doc ? { id: doc.id, name: doc.title } : { id, name: '[Removed]' };
    });

    res.json(result);
  } catch (error) {
    console.error('Get documents by IDs error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// PATCH /api/documents/:id - Update a document
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const { title, content } = updateDocumentSchema.parse(req.body);
    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;

    // Check access
    const hasAccess = await DocumentModel.checkAccess(documentId, userId, organizationId);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updateData: { title?: string; content?: string } = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    const document = await DocumentModel.update(documentId, updateData);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;

    // Check access
    const hasAccess = await DocumentModel.checkAccess(documentId, userId, organizationId);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const deleted = await DocumentModel.delete(documentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
