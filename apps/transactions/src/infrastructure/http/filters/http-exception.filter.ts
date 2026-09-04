import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { type Response } from 'express';

import { HTTP_INTERNAL_ERROR, mapException } from './error-mapping';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, envelope } = mapException(exception);
    if (status >= HTTP_INTERNAL_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception: ${stack}`);
    }
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json(envelope);
  }
}
