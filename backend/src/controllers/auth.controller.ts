import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import { LoginInput, LogoutInput, RefreshInput } from "../validators/auth.validators";

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const { user, tokens } = await authService.login(
    email,
    password,
    requestMeta(req)
  );

  res.status(200).json({
    success: true,
    data: { user, tokens },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;

  const { user, tokens } = await authService.refresh(
    refreshToken,
    requestMeta(req)
  );

  res.status(200).json({
    success: true,
    data: { user, tokens },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as LogoutInput;

  await authService.logout(refreshToken, requestMeta(req));

  res.status(200).json({
    success: true,
    data: { message: "Logged out" },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const user = await authService.getCurrentUser(req.user);

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const account = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  res.json({ success: true, data: await authService.getMyAccount(req.user.id) });
});
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  res.json({ success: true, data: await authService.updateMyProfile(req.user.id, req.body) });
});
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  await authService.changeMyPassword(req.user.id, req.body.currentPassword, req.body.newPassword, requestMeta(req));
  res.json({ success: true, data: { message: "Password changed. Please sign in again." } });
});
export const recoveryInstitutions = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await authService.listRecoveryInstitutions() });
});
