import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { listStaff, createStaff, updateStaff } from '../controllers/hotel.js';
import { hotelListSchema, staffCreateSchema, staffUpdateSchema } from '../validators/hotel.js';

const router = Router();
router.use(protect, authorize('admin', 'manager'));
router.get('/', validate(hotelListSchema), asyncHandler(listStaff));
router.post('/', authorize('admin'), validate(staffCreateSchema), asyncHandler(createStaff));
router.put('/:id', authorize('admin'), validate(staffUpdateSchema), asyncHandler(updateStaff));
export default router;
