import { Router } from "express";
import { getForGallery } from "./lost.dogs.gallery.controller";

export const lostDogsGalleryRouter = Router();

lostDogsGalleryRouter.get("/for-gallery", getForGallery);
