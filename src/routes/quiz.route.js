import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createQuiz, getQuizByNoteId } from "../controllers/quiz.controller.js";

const router = Router();

router.route('/create-quiz/:noteId').post(verifyJWT, createQuiz);
router.route('/get-quiz/:noteId').get(verifyJWT, getQuizByNoteId);

export default router;