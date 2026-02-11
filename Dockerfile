# Step 1: Use Node.js base image (official, lightweight)
FROM node:18-alpine

# Step 2: Set working directory inside container
WORKDIR /app

# Step 3: Copy package files first (for better caching)
COPY package*.json ./

# Step 4: Install dependencies
RUN npm ci --only=production

# Step 5: Copy the rest of the app code
COPY . .

# Step 6: Expose port 5000 (where Express runs)
EXPOSE 5000

# Step 7: Start the server
CMD ["node", "index.js"]
