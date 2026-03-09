import { Request, Response } from "express";
import { uploadService } from "./upload.service";

const resolveType = (req: Request) => {
	if (typeof req.query?.type !== "string") {
		return "image";
	}

	const normalizedType = req.query.type.toLowerCase();
	return normalizedType === "document" ? "document" : "image";
};

export const uploadController = {
	uploadImage: async (req: Request, res: Response) => {
		try {
			if (!req.authUserId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			if (!req.file) {
				return res.status(400).json({ message: "Image file is required" });
			}

			const folder =
				typeof req.body?.folder === "string" ? req.body.folder : undefined;

			const result = await uploadService.uploadImage(req.file, {
				folder,
				uploadedByUserId: req.authUserId,
			});

			return res.status(201).json(result);
		} catch (error) {
			return res.status(400).json({
				message: error instanceof Error ? error.message : "Image upload failed",
			});
		}
	},

	uploadFile: async (req: Request, res: Response) => {
		try {
			if (!req.authUserId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			if (!req.file) {
				return res.status(400).json({ message: "File is required" });
			}

			const folder =
				typeof req.body?.folder === "string" ? req.body.folder : undefined;

			const type = resolveType(req);

			const result = await uploadService.uploadFile(req.file, {
				folder,
				uploadedByUserId: req.authUserId,
			});

			return res.status(201).json({
				...result,
				type,
			});
		} catch (error) {
			return res.status(400).json({
				message: error instanceof Error ? error.message : "File upload failed",
			});
		}
	},

	deleteImage: async (req: Request, res: Response) => {
		try {
			if (!req.authUserId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const storagePath =
				typeof req.body?.path === "string" ? req.body.path : "";

			const result = await uploadService.deleteImage(storagePath);
			return res.status(200).json(result);
		} catch (error) {
			return res.status(400).json({
				message: error instanceof Error ? error.message : "Image deletion failed",
			});
		}
	},
};
