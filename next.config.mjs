/** @type {import('next').NextConfig} */

// FastAPI 백엔드 주소. .env.local 에서 덮어쓸 수 있다.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig = {
  // 백엔드(main.py)에 CORS 미들웨어가 없으므로 브라우저가 직접 호출하지 않고
  // Next.js 서버를 통해 프록시한다. 백엔드 코드는 수정할 필요가 없다.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
