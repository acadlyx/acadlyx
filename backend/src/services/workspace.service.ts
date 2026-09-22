/**
 * ACADLYX workspace service
 *
 * The canonical workspace implementation lives in erp.service.ts.
 * This module intentionally stays as a compatibility facade so older
 * imports do not duplicate or diverge from the ERP workspace logic.
 */

export {
  getMyWorkspace,
} from "./erp.service";
