import { NextResponse, type NextRequest } from 'next/server';

const middleware = (req: NextRequest) => {
  if (!process.env.APP_URL) {
    return NextResponse.next();
  }

  const { host } = new URL(process.env.APP_URL);
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;
  const hostname = req.headers.get('host');

  if (!hostname) {
    return NextResponse.next();
  }

  const currentHost = hostname.replace(`.${host}`, '');

  if (pathname.startsWith(`/_sites`)) {
    return new Response(null, { status: 404 });
  }

  if (!pathname.includes('.') && !pathname.startsWith('/api')) {
    if (hostname === host) {
      url.pathname = pathname;
    } else {
      url.pathname = `/_sites/${currentHost}${pathname}`;
    }

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
};

export default middleware;
