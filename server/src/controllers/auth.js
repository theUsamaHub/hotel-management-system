import { audit } from '../utils/audit.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { requestVerification } from './account.js';
import ApiError from '../utils/ApiError.js';
import { generateTokens, hashToken, setCookies, clearCookies, verifyToken } from '../utils/generateToken.js';

async function startSession(user, req, res) {
  const session = new Session({ user: user._id, authVersion: user.authVersion || 0,
    userAgent: (req.get('user-agent') || 'Unknown client').slice(0, 300) });
  const tokens = generateTokens(user, session._id);
  session.tokenHash = hashToken(tokens.refreshToken);
  session.expiresAt = new Date(verifyToken(tokens.refreshToken, 'refresh').exp * 1000);
  await session.save();
  setCookies(res, tokens);
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'Email already registered');
  const user = await User.create({ name, email, password, role: 'user' });
  await startSession(user, req, res);
  await audit({ ...req, user }, req.path === '/register' ? 'auth.register' : 'auth.login', user._id);
  await requestVerification(user);
  res.status(201).json({ success: true, message: 'Account created', user });
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+password +authVersion');
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  await startSession(user, req, res);
  await audit({ ...req, user }, req.path === '/register' ? 'auth.register' : 'auth.login', user._id);
  res.json({ success: true, message: 'Signed in', user });
}

export async function refresh(req, res) {
  const token = req.cookies.refreshToken;
  let payload;
  try { payload = verifyToken(token, 'refresh'); }
  catch { clearCookies(res); throw new ApiError(401, 'Session expired'); }
  if (!/^[a-f\d]{24}$/i.test(payload.sid || '')) { clearCookies(res); throw new ApiError(401, 'Session expired'); }
  const user = await User.findById(payload.sub).select('+authVersion');
  if (!user?.isActive || user.authVersion !== payload.version) { clearCookies(res); throw new ApiError(401, 'Session expired'); }
  const tokens = generateTokens(user, payload.sid);
  // Atomic compare-and-swap makes every refresh token single use.
  const session = await Session.findOneAndUpdate(
    { _id: payload.sid, user: user._id, authVersion: user.authVersion, tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
    { $set: { tokenHash: hashToken(tokens.refreshToken), lastUsedAt: new Date(),
      expiresAt: new Date(verifyToken(tokens.refreshToken, 'refresh').exp * 1000) } },
    { returnDocument: 'after' },
  );
  if (!session) { clearCookies(res); throw new ApiError(401, 'Session expired'); }
  setCookies(res, tokens);
  res.json({ success: true, message: 'Session refreshed', user });
}

export async function logout(req, res) {
  if (req.cookies.refreshToken) {
    const session = await Session.findOneAndDelete({ tokenHash: hashToken(req.cookies.refreshToken) });
    const user = session && await User.findById(session.user);
    if (user) await audit({ ...req, user }, 'auth.logout', user._id);
  }
  clearCookies(res);
  res.json({ success: true, message: 'Signed out' });
}

export function getMe(req, res) {
  res.json({ success: true, message: 'Current user', user: req.user });
}
