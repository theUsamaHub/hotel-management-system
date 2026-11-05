import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/roles.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'user' },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null, index: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 80, default: '' },
  isActive: { type: Boolean, default: true },
  refreshTokenHash: { type: String, select: false },
  authVersion: { type: Number, default: 0, select: false },
  emailVerified: { type: Boolean, default: false },
  pendingEmail: { type: String, select: false },
  resetHash: { type: String, select: false },
  resetExpires: { type: Date, select: false },
  resetSentAt: { type: Date, select: false },
  verificationHash: { type: String, select: false },
  verificationExpires: { type: Date, select: false },
  verificationSentAt: { type: Date, select: false },
  avatar: { type: Object, select: false },
  hasAvatar: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.refreshTokenHash;
      for (const key of ['authVersion', 'pendingEmail', 'resetHash', 'resetExpires', 'resetSentAt',
        'verificationHash', 'verificationExpires', 'verificationSentAt', 'avatar']) delete ret[key];
      delete ret.__v;
      return ret;
    },
  },
});

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.index({ resetHash: 1 }, { sparse: true });
userSchema.index({ verificationHash: 1 }, { sparse: true });
userSchema.methods.comparePassword = function (password) { return bcrypt.compare(password, this.password); };

export default mongoose.model('User', userSchema);
