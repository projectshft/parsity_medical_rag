import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	datasource: {
		// Optional so `prisma generate` works before .env is filled in.
		url: process.env.DATABASE_URL ?? '',
	},
});
