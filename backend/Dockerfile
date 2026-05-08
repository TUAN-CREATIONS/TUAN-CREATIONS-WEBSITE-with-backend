FROM node:20-alpine

WORKDIR /app

# Copy entire monorepo
COPY . .

# Build frontend
RUN npm install
RUN npm run build

# Install backend dependencies
RUN cd backend && npm install --production

# Expose port
EXPOSE 4000

# Start backend from backend directory
WORKDIR /app/backend
CMD ["npm", "start"]