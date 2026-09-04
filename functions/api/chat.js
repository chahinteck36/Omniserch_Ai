// functions/api/chat.js

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 1. التحقق من وجود مفتاح البيئة
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "مفتاح OPENROUTER_API_KEY غير محدد في إعدادات البيئة" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. استقبال البيانات من كود Frontend
    const body = await request.json();
    const { messages, model = "meta-llama/llama-3.1-8b-instruct:free" } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "تنسيق الرسائل غير صحيح" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. إرسال الطلب إلى OpenRouter API
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": request.headers.get("origin") || "https://pages.dev",
        "X-Title": "Cloudflare Pages App",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages
      })
    });

    const data = await openRouterResponse.json();

    // 4. إرجاع الرد للعميل
    return new Response(JSON.stringify(data), {
      status: openRouterResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "حدث خطأ في الخادم الداخلي", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// التعامل مع طلبات OPTIONS الخاصة بـ CORS عند الحاجة
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
