import express from 'express'

import NannyShare from './nannyShare.js'
import PostJob from './postJob.js'
import BookHire from './bookHire.js'
import PhantombusterRoutes from './phantombuster.routes.js'

// What is left of the original Routes/ tree.
//
// Every other prefix now lives in src/modules/ and is mounted by the module
// registry, which Application mounts BEFORE this router — so anything still
// declared here for a migrated prefix would be unreachable dead code. These
// four are the whole remainder, and each is here for a stated reason rather
// than because nobody got to it:
//
//   /nannyShare — 7 frontend call sites; backs the six-step questionnaire that
//   /postJob    — 6 call sites; post-a-job and the job listing screens.
//   /book-hire  — 30 call sites across five Redux slices.
//
//     All three were scoped out of the module restructure by the project owner.
//     They are left working and untouched; excluding them from the refactor is
//     not the same as deleting them.
//
//   /phantombuster — the intake for scraped Facebook profile data, which is
//     AI-classified into lead lists of people who never opted in. Left running
//     exactly as it was and deliberately not restructured.
//
// tests/architecture/routes.test.js records all four in UNMIGRATED_PREFIXES and
// asserts the migrated ones reproduce their pre-refactor route tables exactly.

const router = express.Router()

router.use('/nannyShare', NannyShare)
router.use('/postJob', PostJob)
router.use('/book-hire', BookHire)
router.use('/phantombuster', PhantombusterRoutes)

export default router
