import { Router } from "express";
import { decreaseClap, getClaps, increaseClap } from "../controllers/clap.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Custom middleware example
function customVerifyJWT(req, res, next) {
  verifyJWT(req, res, function(err) {
    // if (err){
    //     console.log(err)
    //     return next();
    // }
    next();
  });
}

router.route("/increment/:noteId").patch(verifyJWT, increaseClap);
router.route("/decrement/:noteId").patch(verifyJWT, decreaseClap);
router.route("/get-claps/:noteId").get(customVerifyJWT, getClaps);

export default router