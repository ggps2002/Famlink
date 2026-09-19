import express from 'express'

import PhantombusterRoutes from './phantombuster.routes.js'

// What is left of the original Routes/ tree: one endpoint.
//
// Every other prefix now lives in src/modules/ and is mounted by the module
// registry, which Application mounts BEFORE this router — so anything still
// declared here for a migrated prefix would be unreachable dead code.
//
// Resolved on 2026-09-20:
//
//   /nannyShare — migrated to modules/nannyShare (8 routes).
//   /postJob    — migrated to modules/job (10 routes).
//   /book-hire  — RETIRED, backend and frontend together: 14 routes, the
//                 booking socket, seven Redux slices and the /hire screens.
//                 See RETIRED_PREFIXES in tests/architecture/routes.test.js.
//
//   /phantombuster — still here. It is the intake for scraped Facebook profile
//     data, which is AI-classified into "Parent" / "Caregiver" / "Nanny Share"
//     lead lists — including an inferred city and an inferred children's age —
//     for people who never opted in. Left running exactly as it was and not
//     restructured, which is the same position taken on 2026-07-18. Nothing
//     about its behaviour has changed in this refactor.
//
// tests/architecture/routes.test.js records /phantombuster in
// UNMIGRATED_PREFIXES and asserts every migrated prefix reproduces its
// pre-refactor route table exactly.

const router = express.Router()

router.use('/phantombuster', PhantombusterRoutes)

export default router
