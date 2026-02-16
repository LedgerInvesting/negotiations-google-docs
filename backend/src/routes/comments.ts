import { Router, Response } from 'express';
import { CommentModel } from '../models/comment';
import { DocumentModel } from '../models/document';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get all comments for a document
router.get('/documents/:documentId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;

    // Check access to document
    const hasAccess = await DocumentModel.checkAccess(documentId, userId, organizationId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comments = await CommentModel.getByDocumentId(documentId);
    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create a comment or reply
router.post('/documents/:documentId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const userId = req.user!.userId;
    const organizationId = req.user!.orgId;
    const { commentId, text, authorName, parentId } = req.body;

    if (!commentId || !text || !authorName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check access to document
    const hasAccess = await DocumentModel.checkAccess(documentId, userId, organizationId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parentComment = await CommentModel.getById(parentId);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (parentComment.document_id !== documentId) {
        return res.status(400).json({ error: 'Parent comment belongs to a different document' });
      }
    }

    // Generate a unique comment_id using timestamp + random suffix
    // This ensures each comment has a unique, persistent ID
    const uniqueCommentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const comment = await CommentModel.create({
      comment_id: uniqueCommentId,
      document_id: documentId,
      text,
      author_id: userId,
      author_name: authorName,
      parent_id: parentId || null,
    });

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Update a comment
router.put('/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.userId;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Get the comment to check ownership
    const existingComment = await CommentModel.getByCommentId(commentId);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.author_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comment = await CommentModel.update(commentId, { text });
    res.json({ comment });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    // Get the comment to check ownership
    const existingComment = await CommentModel.getByCommentId(commentId);
    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.author_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await CommentModel.delete(commentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
