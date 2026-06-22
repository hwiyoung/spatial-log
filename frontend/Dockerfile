# 멀티스테이지: dev(기본, Vite HMR) / prod(정적 빌드 → nginx 서빙)
# - 기본 빌드(타깃 미지정)는 dev → 기존 개발 폴더 동작 그대로 유지
# - 배포는 docker-compose 의 target=${FRONTEND_TARGET} 로 prod 선택

# --- build: Vite 앱을 정적 자산으로 컴파일 ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# --- prod: 빌드 결과를 nginx 로 3000 포트에 서빙 (기존 배선과 동일 포트) ---
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

# --- dev (기본 타깃): Vite dev 서버 + HMR ---
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
