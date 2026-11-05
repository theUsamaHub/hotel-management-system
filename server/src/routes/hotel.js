import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { STAFF_ROLES } from '../config/roles.js';
import { listHotels, getHotel, createHotel, updateHotel } from '../controllers/hotel.js';
import { hotelListSchema, hotelGetSchema, hotelCreateSchema, hotelUpdateSchema } from '../validators/hotel.js';

const router = Router();
router.use(protect, authorize('admin', ...STAFF_ROLES));
router.get('/', validate(hotelListSchema), asyncHandler(listHotels));
router.get('/:id', validate(hotelGetSchema), asyncHandler(getHotel));
router.post('/', authorize('admin'), validate(hotelCreateSchema), asyncHandler(createHotel));
router.put('/:id', authorize('admin'), validate(hotelUpdateSchema), asyncHandler(updateHotel));
export default router;
