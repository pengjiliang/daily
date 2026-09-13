/**
 * @Public() 装饰器：在路由/控制器上打标记，全局 JwtAuthGuard 检测到该标记即跳过登录校验。
 */
import { SetMetadata } from '@nestjs/common';

/** 元数据 key，需与 JwtAuthGuard 中读取的 key 保持一致 */
export const IS_PUBLIC_KEY = 'isPublic';
/** 用法：@Public() 标注在 Controller 方法上表示该接口免登录 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
