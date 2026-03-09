import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { mobileApiRouter } from "../mobile/api";
import { backofficeApiRouter } from "../backoffice/api";
import { dogPhotosImagesRouter } from "../mobile/api/dogRecovery/dog.photos.route";
import { lostDogsGalleryRouter } from "../mobile/api/dogRecovery/lost.dogs.gallery.route";

export const apiRouter = Router();

apiRouter.use("/", healthRouter);
apiRouter.use("/mobile", mobileApiRouter);
apiRouter.use("/backoffice", backofficeApiRouter);
// Dog photos at /api/dogs (GET /:dogId/photos, PATCH /:dogId/images) for frontends using baseUrl/dogs/...
apiRouter.use("/dogs", dogPhotosImagesRouter);
// For FastAPI GALLERY_API_URL: GET /api/lost-dogs/for-gallery (lost dogs + frontal/lateral image URLs)
apiRouter.use("/lost-dogs", lostDogsGalleryRouter);
