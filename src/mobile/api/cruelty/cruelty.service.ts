import { uploadFile } from "../../../lib/firebase";
import { prisma } from "../../../lib/prisma";
import axios from "axios";

type CrueltyReportInput = {
    description: string;
    incidentDate: string;
    locationLat: number | string;
    locationLng: number | string;
    address: string;
    contactInfo: string;
    isAnonymous: boolean | string;
    hasNoseScan: boolean | string;
};

export const crueltyService = {
    reportCruelty: async (
        input: CrueltyReportInput,
        images: Express.Multer.File[],
    ) => {
        if (!input.description?.trim()) {
            throw new Error("Description is required");
        }

        // Parse numeric and boolean values from string if they come from form-data
        const lat =
            typeof input.locationLat === "string"
                ? parseFloat(input.locationLat)
                : input.locationLat;
        const lng =
            typeof input.locationLng === "string"
                ? parseFloat(input.locationLng)
                : input.locationLng;
        const isAnonymous =
            typeof input.isAnonymous === "string"
                ? input.isAnonymous === "true"
                : !!input.isAnonymous;
        const hasNoseScan =
            typeof input.hasNoseScan === "string"
                ? input.hasNoseScan === "true"
                : !!input.hasNoseScan;

        // Upload images to Firebase and call detection model
        const imageUrls: string[] = [];
        const detections: any[] = [];
        if (images && images.length > 0) {
            for (const image of images) {
                // Upload to Firebase
                const url = await uploadFile(image, "cruelty");
                imageUrls.push(url);

                // Call detection model
                try {
                    const detectionUrl = process.env.DETECTION_MODEL_URL;
                    if (detectionUrl) {
                        const formData = new FormData();
                        // Create a Blob from the image buffer
                        const blob = new Blob([new Uint8Array(image.buffer)], {
                            type: image.mimetype,
                        });
                        formData.append("file", blob, image.originalname);

                        const response = await axios.post(detectionUrl, formData);

                        console.log(
                            `[Detection Result] for image ${image.originalname}:`,
                            JSON.stringify(response.data, null, 2),
                        );

                        // Capture detections for the response
                        if (response.data && response.data.detections) {
                            detections.push({
                                imageName: image.originalname,
                                results: response.data.detections.map((d: any) => ({
                                    class: d.class,
                                    confidence: d.confidence,
                                })),
                            });
                        }
                    }
                } catch (error) {
                    console.error(
                        `[Detection Error] for image ${image.originalname}:`,
                        error instanceof Error ? error.message : "Internal detection error",
                    );
                }
            }
        }

        const report = await prisma.cruelty_report.create({
            data: {
                description: input.description.trim(),
                incident_date: new Date(input.incidentDate),
                location_lat: lat,
                location_lng: lng,
                address: input.address,
                contact_info: input.contactInfo,
                is_anonymous: isAnonymous,
                has_nose_scan: hasNoseScan,
                cruelty_report_image: {
                    create: imageUrls.map((url) => ({
                        image_url: url,
                    })),
                },
            },
            include: {
                cruelty_report_image: true,
            },
        });

        return {
            message: "Cruelty report submitted successfully 🐾",
            report: {
                id: report.id.toString(),
                description: report.description,
                isAnonymous: report.is_anonymous,
                images: report.cruelty_report_image.map((img) => img.image_url),
                detections: detections, // Include detections in the response
            },
        };
    },

    getReports: async () => {
        const reports = await prisma.cruelty_report.findMany({
            include: {
                cruelty_report_image: true,
            },
            orderBy: {
                created_at: "desc",
            },
        });

        return reports.map((report) => ({
            id: report.id.toString(),
            description: report.description,
            incidentDate: report.incident_date,
            locationLat: report.location_lat,
            locationLng: report.location_lng,
            address: report.address,
            isAnonymous: report.is_anonymous,
            hasNoseScan: report.has_nose_scan,
            createdAt: report.created_at,
            images: report.cruelty_report_image.map((img) => img.image_url),
        }));
    },
};
