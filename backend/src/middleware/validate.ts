import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { AppError } from "./errorHandler";

function formatZodError(err: ZodError, label: string): AppError {
const message = err.errors
.map((e) => `${e.path.join(".") || label}: ${e.message}`)
.join("; ");

return new AppError(`Validation error: ${message}`, 400);
}

/**

* Validates req.body against a Zod schema.
*
* On success, req.body is replaced with the parsed result.
* Zod therefore strips unknown fields according to the schema.
  */
  export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
  try {
  req.body = schema.parse(req.body);
  next();
  } catch (err) {
  if (err instanceof ZodError) {
  next(formatZodError(err, "body"));
  return;
  }

  next(err);
  }
  };
  }

/**

* Validates req.query against a Zod schema.
*
* Used for list/filter endpoints such as:
* * page
* * pageSize
* * search
* * isActive
* * sorting/filtering parameters
    */
    export function validateQuery(schema: ZodTypeAny) {
    return (req: Request, _res: Response, next: NextFunction): void => {
    try {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
    } catch (err) {
    if (err instanceof ZodError) {
    next(formatZodError(err, "query"));
    return;
    }

    next(err);
    }
    };
    }

/**

* Validates req.params against a Zod schema.
*
* Used for routes such as:
* /students/:studentId
* /notifications/:id
* /documents/:id
*
* On success, req.params is replaced with the parsed result.
  */
  export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
  try {
  req.params = schema.parse(req.params) as typeof req.params;
  next();
  } catch (err) {
  if (err instanceof ZodError) {
  next(formatZodError(err, "params"));
  return;
  }

  next(err);
  }
  };
  }
