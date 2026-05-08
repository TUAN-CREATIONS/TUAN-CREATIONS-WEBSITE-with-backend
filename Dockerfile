FROM node:20-alpine

WORKDIR /app

# Copy entire monorepo
COPY . .

# Install frontend dependencies
RUN npm install

# Install backend dependencies
RUN cd backend && npm install --production

# Build frontend
RUN npm run build

# Expose port
EXPOSE 4000

# Start backend
CMD ["sh", "-c", "cd backend && npm start"]
