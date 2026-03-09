import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

const pool = new Pool({
	connectionString: env.databaseUrl,
	ssl: {
		rejectUnauthorized: env.dbSslRejectUnauthorized,
	},
});

// Prevent Node.js from crashing on idle-client or connection errors
pool.on("error", (err) => {
	console.error("[pg:pool] Unexpected error on idle client:", err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
