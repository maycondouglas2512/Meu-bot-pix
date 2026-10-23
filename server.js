const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Conexão com o Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Rota 1: Teste de Funcionamento (Healthcheck)
app.get('/', (req, res) => {
  res.send('O Bot de Câmbio Pix está ativo e rodando perfeitamente!');
});

// Rota 2: Calcular Cotação Instantânea
app.get('/cotacao', async (req, res) => {
  const { moeda, valor_brl } = req.query;

  if (!moeda || !valor_brl) {
    return res.status(400).json({ erro: 'Envie a moeda (BOB ou PYG) e o valor_brl' });
  }

  const { data, error } = await supabase
    .from('cotacoes')
    .select('taxa_venda')
    .eq('moeda', moeda.toUpperCase())
    .single();

  if (error || !data) {
    return res.status(404).json({ erro: 'Moeda não encontrada no sistema.' });
  }

  const valorDestino = (parseFloat(valor_brl) * data.taxa_venda).toFixed(2);

  return res.json({
    brl: parseFloat(valor_brl),
    moeda: moeda.toUpperCase(),
    taxa: data.taxa_venda,
    receber_no_destino: parseFloat(valorDestino)
  });
});

// Rota 3: Webhook de Confirmação Instantânea do Pix
app.post('/webhook/pix', async (req, res) => {
  try {
    const { event, data } = req.body;

    // Confirmação instantânea para a API do Pix sem travamento
    res.status(200).json({ status: 'sucesso', recebido: true });

    if (event === 'pix.received' || event === 'pix.automatic.paid') {
      const { endToEndId, value, destinationKey, destinationCurrency } = data;

      console.log(`[PIX RECEBIDO] R$ ${value} | E2E: ${endToEndId}`);

      // Registrar transação no banco Supabase
      await supabase.from('transacoes').insert([
        {
          e2e_id: endToEndId,
          valor_brl: value,
          moeda_destino: destinationCurrency || 'BOB',
          valor_destino: value * 1.35, // Aplica cotação
          chave_pix_destino: destinationKey || 'N/A',
          status: 'PROCESSADO'
        }
      ]);
    }
  } catch (err) {
    console.error('Erro no processamento do Webhook:', err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
