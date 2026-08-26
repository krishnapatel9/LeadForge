FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the app
COPY . .

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

EXPOSE 3001

# Run the dev server
CMD ["npm", "run", "dev", "--", "-p", "3001"]
