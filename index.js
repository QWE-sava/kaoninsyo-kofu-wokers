export default {
  async fetch(request, env) {
    // CORS（別ドメインからのアクセス許可）設定
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // プリフライトリクエスト対応
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        const { descriptor } = await request.json();

        if (!descriptor || descriptor.length !== 128) {
          return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers: corsHeaders });
        }

        // 1. D1から全データ取得
        const { results } = await env.DB.prepare("SELECT descriptor FROM face_votes").all();

        // 2. 類似判定（ユークリッド距離）
        const threshold = 0.5; // 0.4〜0.5程度が適切
        const isAlreadyVoted = results.some(row => {
          const saved = JSON.parse(row.descriptor);
          const dist = Math.sqrt(descriptor.reduce((sum, val, i) => sum + Math.pow(val - saved[i], 2), 0));
          return dist < threshold;
        });

        if (isAlreadyVoted) {
          return new Response(JSON.stringify({ status: "error", message: "既に投票済みです" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 3. 重複がなければDBに保存
        await env.DB.prepare("INSERT INTO face_votes (descriptor) VALUES (?)")
          .bind(JSON.stringify(descriptor))
          .run();

        return new Response(JSON.stringify({ status: "success", message: "投票を完了しました！" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Waseda Kofusai Voting System API", { status: 200 });
  }
};
