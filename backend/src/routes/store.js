const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const prisma = require('../prisma');
const { success, error } = require('../utils/apiResponse');

const router = express.Router();
router.use(authMiddleware);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `badge-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, SVG and WebP images are allowed.'));
    }
  },
});

// ==========================================
// STORE & BADGES
// ==========================================

// Get all badges
router.get('/badges', async (req, res, next) => {
  try {
    const badges = await prisma.badge.findMany();
    return success(res, badges);
  } catch (err) {
    next(err);
  }
});

// Get all active store listings
router.get('/listings', async (req, res, next) => {
  try {
    const listings = await prisma.storeListing.findMany({
      include: { badge: true },
      orderBy: { createdAt: 'desc' }
    });
    return success(res, listings);
  } catch (err) {
    next(err);
  }
});

// Admin: Create a badge
router.post('/admin/badges', upload.single('image'), [
  body('name').notEmpty(),
  body('description').notEmpty()
], async (req, res, next) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (dbUser.globalRing !== 0 && !dbUser.canManageStore) return error(res, 'FORBIDDEN', 'Admin or Store Manager only', 403);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, 'VALIDATION', 'Invalid data', 400);

    const { name, description, isEventBadge } = req.body;
    let imageUrl = req.body.imageUrl;
    
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    
    if (!imageUrl) return error(res, 'VALIDATION', 'Image URL or file is required', 400);
    
    const badge = await prisma.badge.create({
      data: { name, description, imageUrl, isEventBadge: isEventBadge === 'true' || isEventBadge === true }
    });
    return success(res, badge, 201);
  } catch (err) {
    next(err);
  }
});

// Admin: Create store listing
router.post('/admin/listings', [
  body('badgeId').notEmpty(),
  body('price').isInt({ min: 0 }),
  body('quantity').isInt() // -1 for infinite
], async (req, res, next) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (dbUser.globalRing !== 0 && !dbUser.canManageStore) return error(res, 'FORBIDDEN', 'Admin or Store Manager only', 403);

    const { badgeId, price, quantity } = req.body;
    const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge || badge.isEventBadge) return error(res, 'VALIDATION', 'Invalid badge or badge is an event badge', 400);

    const listing = await prisma.storeListing.create({
      data: { badgeId, price, quantity }
    });
    return success(res, listing, 201);
  } catch (err) {
    next(err);
  }
});

// Admin: Mint credits for a user
router.post('/admin/mint-credits', [
  body('userId').notEmpty(),
  body('amount').isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (dbUser.globalRing !== 0) return error(res, 'FORBIDDEN', 'Admin only', 403);
    const { userId, amount } = req.body;

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: userId },
          { email: userId },
          ...(userId.match(/^[0-9a-fA-F]{24}$/) ? [{ id: userId }] : [])
        ]
      }
    });

    if (!targetUser) {
      return error(res, 'NOT_FOUND', 'User not found. Try exact ID, username, or email.', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetUser.id }, data: { creditBalance: { increment: amount } } });
      await tx.transaction.create({
        data: { senderId: null, receiverId: targetUser.id, amount, type: 'transfer' }
      });
    });
    return success(res, { message: 'Credits minted' });
  } catch (err) {
    next(err);
  }
});

// Purchase a badge
router.post('/purchase', [
  body('listingId').notEmpty()
], async (req, res, next) => {
  try {
    const { listingId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const listing = await prisma.storeListing.findUnique({ where: { id: listingId }, include: { badge: true } });

    if (!listing) return error(res, 'NOT_FOUND', 'Listing not found', 404);
    if (listing.quantity !== -1 && listing.sold >= listing.quantity) return error(res, 'VALIDATION', 'Sold out', 400);
    if (user.globalRing !== 0 && user.creditBalance < listing.price) return error(res, 'VALIDATION', 'Insufficient credits', 400);

    const alreadyOwns = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: user.id, badgeId: listing.badgeId } }
    });
    if (alreadyOwns) return error(res, 'VALIDATION', 'You already own this badge', 400);

    // Perform transaction
    await prisma.$transaction(async (tx) => {
      // 1. Deduct credits
      if (user.globalRing !== 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { creditBalance: { decrement: listing.price } }
        });
      }
      // 2. Increment sold count
      await tx.storeListing.update({
        where: { id: listing.id },
        data: { sold: { increment: 1 } }
      });
      // 3. Grant Badge
      await tx.userBadge.create({
        data: { userId: user.id, badgeId: listing.badgeId, source: 'store' }
      });
      // 4. Create Ledger Record
      await tx.transaction.create({
        data: {
          senderId: user.id,
          receiverId: user.id, // self transaction or system (could be null sender, but receiver is system? Let's use receiverId=user with system transfer type)
          amount: listing.price,
          type: 'purchase',
          referenceId: listing.id
        }
      });
    });

    return success(res, { message: 'Purchase successful' });
  } catch (err) {
    next(err);
  }
});

// Get user's inventory
router.get('/inventory', async (req, res, next) => {
  try {
    const inventory = await prisma.userBadge.findMany({
      where: { userId: req.user.id },
      include: { badge: true }
    });
    return success(res, inventory);
  } catch (err) {
    next(err);
  }
});

// Set display badges
router.post('/display-badges', [
  body('badgeIds').isArray({ max: 5 })
], async (req, res, next) => {
  try {
    const { badgeIds } = req.body;
    
    // Verify user owns all requested badges
    const owned = await prisma.userBadge.findMany({
      where: { userId: req.user.id, badgeId: { in: badgeIds } }
    });
    
    if (owned.length !== badgeIds.length) {
      return error(res, 'VALIDATION', 'You do not own all these badges', 400);
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { displayBadges: badgeIds }
    });
    
    return success(res, { message: 'Display badges updated', displayBadges: user.displayBadges });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// LEDGER & CREDITS
// ==========================================

// Transfer credits
router.post('/transfer', [
  body('receiverId').notEmpty(),
  body('amount').isInt({ min: 1 })
], async (req, res, next) => {
  try {
    const { receiverId, amount } = req.body;
    const senderId = req.user.id;

    if (senderId === receiverId) return error(res, 'VALIDATION', 'Cannot transfer to yourself', 400);

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    if (sender.globalRing !== 0 && sender.creditBalance < amount) return error(res, 'VALIDATION', 'Insufficient credits', 400);

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return error(res, 'NOT_FOUND', 'Receiver not found', 404);

    await prisma.$transaction(async (tx) => {
      // 1. Deduct sender
      if (sender.globalRing !== 0) {
        await tx.user.update({ where: { id: senderId }, data: { creditBalance: { decrement: amount } } });
      }
      // 2. Add receiver
      await tx.user.update({ where: { id: receiverId }, data: { creditBalance: { increment: amount } } });
      // 3. Create Ledger Record
      await tx.transaction.create({
        data: { senderId, receiverId, amount, type: 'transfer' }
      });
    });

    return success(res, { message: 'Transfer successful' });
  } catch (err) {
    next(err);
  }
});

// Get user credit balance and transaction history
router.get('/ledger', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }]
      },
      include: {
        sender: { select: { id: true, displayName: true, username: true } },
        receiver: { select: { id: true, displayName: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return success(res, { balance: user.creditBalance, transactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
