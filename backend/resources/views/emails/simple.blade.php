<!doctype html>
<html>
<body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#16181d">
<div style="max-width:520px;margin:0 auto;padding:24px">
  <div style="font-weight:700;font-size:18px;margin-bottom:16px">
    <span style="background:#2563eb;color:#fff;border-radius:6px;padding:3px 7px;font-size:13px">GR</span> {{ config('app.name') }}
  </div>
  <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e3e6eb">
    <h2 style="margin:0 0 12px;font-size:18px">{{ $title }}</h2>
    {!! $bodyHtml !!}
  </div>
  <p style="color:#8a909c;font-size:12px;margin-top:16px">{{ config('app.name') }} · Maintained by GRFinTech · grfintech.in</p>
</div>
</body>
</html>
