import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Tv,
  Megaphone,
  CheckCircle2,
  Monitor,
  Volume2,
  Wifi,
  ShieldCheck,
  Layers,
  Building2,
  Sparkles,
  Clock,
  Radio,
  FileSpreadsheet,
  Check,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientName?: string;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  defaultClientName = '',
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [clientName, setClientName] = useState(defaultClientName);
  const [consultantName, setConsultantName] = useState('Consultoria Comercial');
  const [consultantContact, setConsultantContact] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const totalSlides = 7;

  // Function to generate and download high-quality multi-page PDF using jsPDF
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      // Create A4 Landscape PDF (297mm x 210mm)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 297;
      const pageHeight = 210;

      const primaryColor = [37, 99, 235]; // #2563eb (Blue 600)
      const darkBg = [15, 23, 42]; // #0f172a (Slate 900)
      const cardBg = [30, 41, 59]; // #1e293b (Slate 800)
      const textLight = [241, 245, 249]; // #f1f5f9
      const textMuted = [148, 163, 184]; // #94a3b8
      const accentGreen = [16, 185, 129]; // #10b981
      const accentAmber = [245, 158, 11]; // #f59e0b

      const drawHeader = (slideNum: number, title: string, subtitle: string) => {
        // Top colored bar
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');

        // Header Background
        doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        doc.rect(0, 5, pageWidth, 28, 'F');

        // Brand / Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(title.toUpperCase(), 16, 18);

        // Subtitle
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(subtitle, 16, 25);

        // Right side badge
        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
        doc.roundedRect(pageWidth - 65, 11, 50, 16, 3, 3, 'F');
        doc.setTextColor(37, 99, 235);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('MÍDIA INDOOR & CALL', pageWidth - 60, 18);
        doc.setFontSize(8);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(`SLIDE ${slideNum} DE ${totalSlides}`, pageWidth - 60, 23);

        // Divider
        doc.setDrawColor(51, 65, 85);
        doc.line(16, 33, pageWidth - 16, 33);
      };

      const drawFooter = (slideNum: number) => {
        doc.setDrawColor(51, 65, 85);
        doc.line(16, pageHeight - 14, pageWidth - 16, pageHeight - 14);

        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const preparedText = clientName ? `Apresentação preparada exclusivamente para: ${clientName}` : 'Apresentação Comercial Executiva';
        doc.text(preparedText, 16, pageHeight - 8);

        doc.text('Plataforma Inteligente de TV Corporativa e Chamada de Senhas em Nuvem', pageWidth / 2, pageHeight - 8, { align: 'center' });
        doc.text(`Página ${slideNum} / ${totalSlides}`, pageWidth - 16, pageHeight - 8, { align: 'right' });
      };

      // ----------------------------------------------------
      // SLIDE 1: CAPA
      // ----------------------------------------------------
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Top Accent
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 8, 'F');

      // Card container
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(20, 25, pageWidth - 40, 155, 6, 6, 'F');

      // Badge
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(35, 42, 70, 9, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TECNOLOGIA & ATENDIMENTO', 38, 48);

      // Title
      doc.setFontSize(26);
      doc.text('Mídia Indoor Inteligente', 35, 66);
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246); // light blue
      doc.text('& Painel de Chamada de Senhas com Voz', 35, 76);

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(textLight[0], textLight[1], textLight[2]);
      doc.text(
        'Transforme a recepção da sua empresa em um canal de comunicação moderno, organizado e interativo.',
        35,
        90
      );
      doc.text(
        'Exiba vídeos, promoções, clima e notícias ao vivo, integrados à chamada de senhas por voz natural em tempo real.',
        35,
        97
      );

      // Feature highlights
      const highlights = [
        'TV Corporativa (Digital Signage em Nuvem)',
        'Chamadas de Senhas com Áudio TTS em Português',
        'Notícias em Tempo Real (RSS) & Previsão do Tempo',
        'Compatível com Smart TVs, TV Box e Monitores Comuns',
      ];

      highlights.forEach((hl, i) => {
        const x = 35 + (i % 2) * 115;
        const y = 115 + Math.floor(i / 2) * 16;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x, y, 105, 12, 2, 2, 'F');
        doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
        doc.circle(x + 5, y + 6, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(hl, x + 11, y + 7.5);
      });

      // Bottom client reference
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(35, 150, pageWidth - 70, 18, 3, 3, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(
        clientName ? `Proposta elaborada para: ${clientName}` : 'Proposta Comercial para Modernização do Atendimento',
        42,
        158
      );
      doc.text(`Apresentado por: ${consultantName || 'Especialista em Soluções Corporativas'}`, 42, 163);

      drawFooter(1);

      // ----------------------------------------------------
      // SLIDE 2: DESAFIOS X SOLUÇÃO
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(2, 'O Problema Atual x Nossa Solução', 'Por que as empresas estão abandonando painéis tradicionais e canais de TV abertos');

      // Left Column: The Problem
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(16, 40, 128, 145, 4, 4, 'F');
      doc.setFillColor(239, 68, 68); // Red
      doc.roundedRect(24, 48, 60, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('O CENÁRIO TRADICIONAL', 27, 53.5);

      const problems = [
        {
          title: 'Esperas Cansativas e Filas Confusas',
          desc: 'Ambientes silenciosos ou sem sinalização clara geram ansiedade e aumentam a sensação de demora.',
        },
        {
          title: 'Painéis de LED Caros e Obsoletos',
          desc: 'Equipamentos caros, limitados a dígitos vermelhos, barulhentos e sem qualquer recurso visual moderno.',
        },
        {
          title: 'TVs em Canais Abertos',
          desc: 'Transmitir novelas ou notícias ruins de canais abertos pode expor anúncios da concorrência e gerar desconforto.',
        },
        {
          title: 'Falta de Controle Centralizado',
          desc: 'Dificuldade para atualizar avisos, trocar promoções ou coordenar múltiplos atendentes.',
        },
      ];

      problems.forEach((p, idx) => {
        const y = 64 + idx * 27;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(24, y, 112, 23, 2, 2, 'F');
        doc.setTextColor(248, 113, 113);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`x  ${p.title}`, 28, y + 7);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(doc.splitTextToSize(p.desc, 104), 28, y + 13);
      });

      // Right Column: The Solution
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(152, 40, 128, 145, 4, 4, 'F');
      doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
      doc.roundedRect(160, 48, 60, 8, 2, 2, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('NOSSA SOLUÇÃO INTELIGENTE', 163, 53.5);

      const solutions = [
        {
          title: 'Comunicação Visual Atraente',
          desc: 'Enquanto o cliente aguarda, sua marca exibe vídeos, fotos, campanhas institucionais e produtos em alta definição.',
        },
        {
          title: 'Chamadas com Voz em Português',
          desc: 'A TV interrompe suavemente o conteúdo e fala o nome ou a senha com clareza cristalina sem caixas de som caras.',
        },
        {
          title: 'Conteúdo Dinâmico e Relevante',
          desc: 'Notícias atualizadas automaticamente via RSS e previsão do clima para manter o público engajado.',
        },
        {
          title: 'Operação Simples pelo Celular ou PC',
          desc: 'Seus atendentes chamam o próximo cliente com 1 toque, sincronizando instantaneamente com a tela da recepção.',
        },
      ];

      solutions.forEach((s, idx) => {
        const y = 64 + idx * 27;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(160, y, 112, 23, 2, 2, 'F');
        doc.setTextColor(52, 211, 153);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`v  ${s.title}`, 164, y + 7);
        doc.setTextColor(textLight[0], textLight[1], textLight[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(doc.splitTextToSize(s.desc, 104), 164, y + 13);
      });

      drawFooter(2);

      // ----------------------------------------------------
      // SLIDE 3: COMO FUNCIONA (ARQUITETURA)
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(3, 'Como o Sistema Opera na Prática', 'Três pontas conectadas em tempo real na nuvem, sem necessidade de servidores locais');

      const steps = [
        {
          num: '01',
          title: 'A TV da Recepção (Player)',
          color: [37, 99, 235],
          items: [
            'Roda diretamente em Smart TV, TV Box ou Mini PC',
            'Exibe playlist de mídias, vídeos e fotos',
            'Barra de notícias ao vivo (G1, CNN, etc.)',
            'Widget de clima e relógio com hora certa',
            'Orientação Horizontal ou Vertical (Totens)',
          ],
        },
        {
          num: '02',
          title: 'Terminal do Atendente (Operador)',
          color: [16, 185, 129],
          items: [
            'Acessível via computador, tablet ou smartphone',
            'Disparo de senhas e nomes com 1 clique',
            'Frase fixa padrão para agilidade no atendimento',
            'Painel de diagnóstico de conexão dos players',
            'Zero complicação para o operador no guichê',
          ],
        },
        {
          num: '03',
          title: 'Gestão da Empresa (Gerente)',
          color: [245, 158, 11],
          items: [
            'Cadastro e organização de playlists personalizadas',
            'Upload de imagens e vídeos institucionais',
            'Configuração de canais de notícias e cidades do clima',
            'Gestão de operadores e telas em tempo real',
            'Acesso seguro e centralizado em nuvem',
          ],
        },
      ];

      steps.forEach((st, idx) => {
        const x = 16 + idx * 90;
        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
        doc.roundedRect(x, 42, 85, 140, 4, 4, 'F');

        // Header pill
        doc.setFillColor(st.color[0], st.color[1], st.color[2]);
        doc.roundedRect(x + 8, 50, 20, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(st.num, x + 14, 55.5);

        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(doc.splitTextToSize(st.title, 70), x + 8, 68);

        // Divider
        doc.setDrawColor(51, 65, 85);
        doc.line(x + 8, 76, x + 77, 76);

        // Items
        st.items.forEach((item, itemIdx) => {
          const itemY = 84 + itemIdx * 17;
          doc.setFillColor(15, 23, 42);
          doc.roundedRect(x + 6, itemY - 2, 73, 14, 2, 2, 'F');

          doc.setFillColor(st.color[0], st.color[1], st.color[2]);
          doc.circle(x + 11, itemY + 5, 1.5, 'F');

          doc.setTextColor(textLight[0], textLight[1], textLight[2]);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(doc.splitTextToSize(item, 62), x + 15, itemY + 4);
        });
      });

      drawFooter(3);

      // ----------------------------------------------------
      // SLIDE 4: MODELOS DE PLANOS (SHOW X CALL)
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(4, 'Planos Comerciais Adaptados à Sua Demanda', 'Escolha o modelo ideal de acordo com a finalidade do seu espaço');

      // Plan SHOW
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(20, 42, 120, 142, 5, 5, 'F');

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(30, 50, 100, 20, 3, 3, 'F');
      doc.setTextColor(59, 130, 246);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PLANO SHOW', 36, 60);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Mídia Indoor Pura / TV Corporativa', 36, 66);

      const showPerks = [
        'Exibição de playlists de fotos e vídeos em alta resolução',
        'Barra contínua de notícias em tempo real (RSS)',
        'Widget integrado de previsão do tempo e relógio',
        'Controle de tempo individual de cada mídia',
        'Orientação para TV comum ou Totens Verticais',
        'Ideal para: Lojas, restaurantes, academias e vitrines',
      ];

      showPerks.forEach((p, idx) => {
        const y = 78 + idx * 16;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(30, y, 100, 12, 2, 2, 'F');
        doc.setTextColor(59, 130, 246);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('v', 35, y + 7.5);
        doc.setTextColor(textLight[0], textLight[1], textLight[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(p, 88), 41, y + 7.5);
      });

      // Plan CALL
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(155, 42, 122, 142, 5, 5, 'F');

      // Top highlighted badge for CALL
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(165, 38, 50, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('MAIS COMPLETO', 170, 43);

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(165, 50, 102, 20, 3, 3, 'F');
      doc.setTextColor(52, 211, 153);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PLANO CALL', 171, 60);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Mídia Indoor + Chamador de Senhas com Voz', 171, 66);

      const callPerks = [
        'Tudo incluído do Plano Show (Mídias, Notícias, Clima)',
        'Chamador de senhas e nomes em tempo real',
        'Voz sintetizada com som natural em português (TTS)',
        'Efeito suave: pausa a mídia, chama e retorna ao vídeo',
        'Até 4 operadores cadastrados por tela contratada',
        'Ideal para: Clínicas, laboratórios, cartórios e bancos',
      ];

      callPerks.forEach((p, idx) => {
        const y = 78 + idx * 16;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(165, y, 102, 12, 2, 2, 'F');
        doc.setTextColor(52, 211, 153);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('v', 170, y + 7.5);
        doc.setTextColor(textLight[0], textLight[1], textLight[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(p, 90), 176, y + 7.5);
      });

      drawFooter(4);

      // ----------------------------------------------------
      // SLIDE 5: DIFERENCIAIS E DIAGNÓSTICO
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(5, 'Diferenciais Tecnológicos & Confiabilidade', 'Recursos exclusivos pensados para garantir operação contínua e sem falhas');

      const diffs = [
        {
          title: 'Voz Sintetizada em Português',
          tag: 'ÁUDIO NATURAL',
          color: [37, 99, 235],
          desc: 'Não precisa gravar mensagens de áudio previamente. O sistema lê nomes de pacientes, guichês, salas e senhas com pronúncia impecável.',
        },
        {
          title: 'Diagnóstico em Tempo Real',
          tag: 'CONTROLE OPERACIONAL',
          color: [16, 185, 129],
          desc: 'O atendente sabe no seu painel se a TV da recepção está conectada à internet ou se houve queda de energia/Wi-Fi através do monitoramento contínuo de sinal.',
        },
        {
          title: '100% Responsivo e Portátil',
          tag: 'MULTI-DISPOSITIVO',
          color: [245, 158, 11],
          desc: 'Gerentes e atendentes podem usar seus smartphones Android, iPhones, notebooks ou tablets para gerenciar mídias e fazer chamadas.',
        },
        {
          title: 'Zero Custo de Servidor Local',
          tag: 'NUVEM PRIVADA',
          color: [168, 85, 247],
          desc: 'Toda a infraestrutura roda na nuvem de alta velocidade. Não há necessidade de computadores servidores dedicados dentro do seu estabelecimento.',
        },
      ];

      diffs.forEach((d, idx) => {
        const x = 18 + (idx % 2) * 132;
        const y = 44 + Math.floor(idx / 2) * 70;

        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
        doc.roundedRect(x, y, 126, 64, 4, 4, 'F');

        doc.setFillColor(d.color[0], d.color[1], d.color[2]);
        doc.roundedRect(x + 10, y + 10, 48, 6, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(d.tag, x + 13, y + 14.5);

        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(d.title, x + 10, y + 25);

        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x + 10, y + 30, 106, 26, 2, 2, 'F');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(d.desc, 100), x + 13, y + 36);
      });

      drawFooter(5);

      // ----------------------------------------------------
      // SLIDE 6: FACILIDADE DE IMPLANTAÇÃO
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(6, 'O que é Necessário para Instalar?', 'Implantação rápida e sem obras físicas no seu ambiente');

      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(20, 42, pageWidth - 40, 142, 5, 5, 'F');

      const reqs = [
        {
          num: 'Passo 1',
          title: 'Qualquer Tela ou TV',
          desc: 'Smart TV comum, monitor com entrada HDMI ou até telas antigas já instaladas na sua recepção.',
        },
        {
          num: 'Passo 2',
          title: 'Conexão com a Internet',
          desc: 'Basta um ponto de rede Wi-Fi estável ou cabo de rede convencional conectado à TV/TV Box.',
        },
        {
          num: 'Passo 3',
          title: 'Dispositivo Reprodutor',
          desc: 'Uma TV Box Android básica, Smart TV com navegador ou Mini PC rodando o endereço do seu player.',
        },
      ];

      reqs.forEach((r, idx) => {
        const x = 32 + idx * 78;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x, 54, 72, 85, 3, 3, 'F');

        doc.setFillColor(37, 99, 235);
        doc.roundedRect(x + 8, 62, 28, 7, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(r.num, x + 12, 67);

        doc.setFontSize(10.5);
        doc.text(doc.splitTextToSize(r.title, 56), x + 8, 79);

        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(r.desc, 56), x + 8, 93);
      });

      // Bottom reassurance card
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(32, 148, pageWidth - 64, 26, 3, 3, 'F');
      doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
      doc.circle(42, 161, 3, 'F');

      doc.setTextColor(52, 211, 153);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Implantação Concluída em menos de 15 minutos', 50, 158);

      doc.setTextColor(textLight[0], textLight[1], textLight[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(
        'Basta ligar o dispositivo na tomada, conectar ao Wi-Fi e abrir o link exclusivo do seu player para iniciar a transmissão imediatamente.',
        50,
        165
      );

      drawFooter(6);

      // ----------------------------------------------------
      // SLIDE 7: FECHAMENTO & CONTATO
      // ----------------------------------------------------
      doc.addPage();
      drawHeader(7, 'Próximos Passos & Proposta Comercial', 'Transforme a experiência do seu cliente hoje mesmo');

      // Left Box: Value Summary
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(20, 42, 140, 142, 5, 5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Por que escolher nossa plataforma?', 30, 56);

      const closingBenefits = [
        'Melhora imediata da percepção de espera do seu cliente',
        'Comunicação visual profissional sem propagandas indesejadas',
        'Chamadas de senhas claras, audíveis e sem erros de pronúncia',
        'Investimento acessível e escalável por tela contratada',
        'Suporte técnico e atualizações contínuas em nuvem',
      ];

      closingBenefits.forEach((b, idx) => {
        const y = 68 + idx * 21;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(30, y, 120, 15, 2, 2, 'F');
        doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
        doc.circle(36, y + 7.5, 2, 'F');
        doc.setTextColor(textLight[0], textLight[1], textLight[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(doc.splitTextToSize(b, 106), 42, y + 6.5);
      });

      // Right Box: Proposal Details / Contacts
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(168, 42, 110, 142, 5, 5, 'F');

      doc.setFillColor(37, 99, 235);
      doc.roundedRect(178, 52, 90, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DADOS DA PROPOSTA', 198, 57.5);

      const contactItems = [
        { label: 'CLIENTE:', val: clientName || 'A definir / Empresa Interessada' },
        { label: 'CONSULTOR:', val: consultantName || 'Representante Autorizado' },
        { label: 'CONTATO / TEL:', val: consultantContact || 'Disponível sob consulta' },
        { label: 'MODALIDADE:', val: 'Assinatura Mensal (SaaS)' },
      ];

      contactItems.forEach((c, idx) => {
        const y = 68 + idx * 18;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(178, y, 90, 14, 2, 2, 'F');
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(c.label, 182, y + 5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(c.val, 82), 182, y + 10.5);
      });

      // Call to action button box
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(178, 146, 90, 26, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Agende uma Demonstração', 188, 157);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Veja o sistema funcionando ao vivo!', 188, 163);

      drawFooter(7);

      // Save PDF file to user device
      const fileName = clientName
        ? `Apresentacao_Midia_Indoor_${clientName.replace(/\s+/g, '_')}.pdf`
        : 'Apresentacao_Midia_Indoor_e_Chamadas.pdf';

      doc.save(fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-6 overflow-y-auto overflow-x-hidden">
      <div className="relative w-full max-w-5xl max-w-[calc(100vw-1rem)] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-800/90 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <span>Apresentação Comercial para Clientes</span>
                <span className="text-[10px] bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">
                  Slide {currentSlide + 1} de {totalSlides}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Visualize os slides ou exporte o material completo em PDF para envio ao seu cliente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Baixar apresentação em PDF no seu computador"
            >
              {downloadSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>PDF Baixado!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Imprimir ou Salvar em PDF via Navegador"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Fechar apresentação"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Customization bar (Client name & Consultant) */}
        <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider w-full sm:w-auto">
            Personalizar para o Cliente:
          </span>
          <div className="flex items-center gap-1.5 w-full sm:flex-1 sm:min-w-[180px]">
            <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome da Empresa / Cliente (Ex: Clínica Vida)"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:flex-1 sm:min-w-[160px]">
            <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={consultantName}
              onChange={(e) => setConsultantName(e.target.value)}
              placeholder="Seu Nome / Consultor"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:flex-1 sm:min-w-[160px]">
            <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <input
              type="text"
              value={consultantContact}
              onChange={(e) => setConsultantContact(e.target.value)}
              placeholder="Telefone / WhatsApp / E-mail"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Slide Canvas Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 flex items-center justify-center bg-slate-950/70 overflow-x-hidden">
          <div className="w-full max-w-4xl min-h-[380px] sm:aspect-[16/9] rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-10 shadow-2xl flex flex-col justify-between transition-all duration-300 overflow-x-hidden">
            {/* SLIDE 0: CAPA */}
            {currentSlide === 0 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold uppercase tracking-wider mb-4">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Solução Completa em Nuvem</span>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                    Mídia Indoor Inteligente <br />
                    <span className="text-blue-500">& Painel de Chamada de Senhas com Voz</span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-300 mt-4 leading-relaxed max-w-2xl">
                    Transforme a recepção da sua empresa em um canal de comunicação moderno,
                    organizado e de alto impacto. Entretenha clientes enquanto esperam e organize
                    o fluxo com chamadas sonoras em áudio natural.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Tv className="h-5 w-5 text-blue-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">TV Corporativa</p>
                    <p className="text-[11px] text-slate-400">Fotos e vídeos em alta resolução</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Volume2 className="h-5 w-5 text-emerald-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">Voz em Português</p>
                    <p className="text-[11px] text-slate-400">Chamadas sonoras com áudio TTS</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Radio className="h-5 w-5 text-amber-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">Notícias & Clima</p>
                    <p className="text-[11px] text-slate-400">RSS ao vivo e previsão do tempo</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Wifi className="h-5 w-5 text-purple-400 mb-1.5" />
                    <p className="text-xs font-bold text-white">100% em Nuvem</p>
                    <p className="text-[11px] text-slate-400">Sem servidores locais caros</p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{clientName ? `Proposta preparada para: ${clientName}` : 'Apresentação Comercial Executiva'}</span>
                  <span>{consultantName}</span>
                </div>
              </div>
            )}

            {/* SLIDE 1: O PROBLEMA X A SOLUÇÃO */}
            {currentSlide === 1 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    O Problema Atual x Nossa Solução
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Por que ambientes modernos estão substituindo painéis de LED antigos por TVs inteligentes
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto">
                  <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-4">
                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Como era antes (Sem o Sistema):
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">✕</span>
                        <span>Esperas cansativas com clientes impacientes e recepção desorganizada.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">✕</span>
                        <span>Painéis de LED caros, de tecnologia ultrapassada e barulhentos.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">✕</span>
                        <span>TV ligada em canal aberto exibindo desgraças ou anúncios de concorrentes.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">✕</span>
                        <span>Falta de controle: atendentes precisam gritar nomes na sala de espera.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Com a Nossa Plataforma:
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Comunicação ativa com fotos, vídeos, campanhas e avisos da sua marca.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Chamada por voz sintetizada com som natural e claro em português.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Conteúdo de valor: notícias dinâmicas ao vivo e previsão meteorológica.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Atendentes chamam com 1 clique pelo celular ou computador da recepção.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Valorização imediata da imagem corporativa do seu espaço</span>
                  <span>Mídia Indoor & Call</span>
                </div>
              </div>
            )}

            {/* SLIDE 2: COMO FUNCIONA NA PRÁTICA */}
            {currentSlide === 2 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    Como o Sistema Funciona na Prática
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Três pontas sincronizadas instantaneamente pela nuvem
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto">
                  <div className="rounded-xl border border-slate-800 bg-slate-800/80 p-4">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Monitor className="h-4 w-4" />
                      <span>1. A TV da Recepção</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Exibe vídeos e imagens programadas em loop contínuo. Ao receber uma chamada,
                      a TV pausa suavemente, exibe a senha na tela e fala a mensagem em áudio natural.
                    </p>
                    <div className="mt-3 text-[10px] text-blue-300 bg-blue-950/40 p-2 rounded border border-blue-900">
                      Roda em Smart TV, TV Box ou Mini PC
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-800/80 p-4">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Megaphone className="h-4 w-4" />
                      <span>2. O Atendente / Operador</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Painel rápido e intuitivo para o funcionário chamar senhas ou nomes de clientes.
                      Pode ser operado pelo navegador do computador ou direto no celular.
                    </p>
                    <div className="mt-3 text-[10px] text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-900">
                      1 clique para chamar ou repetir senha
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-800/80 p-4">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      <span>3. O Gestor da Empresa</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Faz o upload de novos vídeos e imagens, cria playlists para dias e horários
                      específicos e controla os operadores e telas da empresa.
                    </p>
                    <div className="mt-3 text-[10px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-900">
                      Acesso seguro e centralizado em nuvem
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Sincronização em milissegundos via Server-Sent Events (SSE)</span>
                  <span>Slide 3</span>
                </div>
              </div>
            )}

            {/* SLIDE 3: PLANOS SHOW X CALL */}
            {currentSlide === 3 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    Modelos de Planos Flexíveis
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Escolha o plano que melhor atende o perfil do seu negócio
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-auto">
                  <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-blue-400 uppercase tracking-tight">Plano SHOW</h3>
                      <span className="text-[10px] font-bold bg-blue-600/30 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                        TV Corporativa
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-4">
                      Ideal para ambientes de exibição contínua sem necessidade de chamadas de senhas.
                    </p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-400" />
                        <span>Playlists ilimitadas de fotos e vídeos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-400" />
                        <span>Notícias em tempo real (RSS G1, CNN, etc.)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-400" />
                        <span>Previsão do tempo e relógio com hora certa</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-400" />
                        <span>Orientação Horizontal (TV) ou Vertical (Totens)</span>
                      </li>
                    </ul>
                    <div className="mt-4 pt-3 border-t border-blue-900/50 text-[11px] text-blue-300 font-semibold">
                      Indicado para: Lojas, restaurantes, academias, hotéis e vitrines.
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-5 relative">
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                      Mais Popular
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-tight">Plano CALL</h3>
                      <span className="text-[10px] font-bold bg-emerald-600/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        Mídia + Chamador
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-4">
                      Solução completa: Mídia Indoor aliada à gestão de atendimento com chamador por voz.
                    </p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Tudo do Plano Show (Mídias, Notícias, Clima)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Chamadas de senhas em tempo real</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Voz sintetizada com som natural em português (TTS)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Até 4 atendentes/operadores por tela contratada</span>
                      </li>
                    </ul>
                    <div className="mt-4 pt-3 border-t border-emerald-900/50 text-[11px] text-emerald-300 font-semibold">
                      Indicado para: Clínicas, laboratórios, cartórios, bancos e hospitais.
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Possibilidade de upgrade a qualquer momento conforme sua demanda cresce</span>
                  <span>Slide 4</span>
                </div>
              </div>
            )}

            {/* SLIDE 4: DIFERENCIAIS TECNOLÓGICOS */}
            {currentSlide === 4 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    Diferenciais e Alta Confiabilidade
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Tecnologia pensada para não deixar seu atendimento na mão
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Volume2 className="h-5 w-5 text-blue-400 mb-2" />
                    <h4 className="text-sm font-bold text-white">Voz Sintetizada em Português</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Lê automaticamente qualquer senha ou nome de paciente digitado pelo atendente,
                      sem necessidade de gravações manuais prévias.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Wifi className="h-5 w-5 text-emerald-400 mb-2" />
                    <h4 className="text-sm font-bold text-white">Painel de Diagnóstico em Tempo Real</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      O atendente sabe no seu painel se a TV da recepção está com conexão ativa ou
                      se houve queda de Wi-Fi ou energia, com aviso preventivo.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/60">
                    <ShieldCheck className="h-5 w-5 text-amber-400 mb-2" />
                    <h4 className="text-sm font-bold text-white">Segurança e Níveis de Acesso</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Separação rígida de papéis: Administrador, Empresa e Operador, garantindo
                      que cada colaborador acesse estritamente suas funções.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/60">
                    <Clock className="h-5 w-5 text-purple-400 mb-2" />
                    <h4 className="text-sm font-bold text-white">Funcionamento Contínuo e Cache</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      O reprodutor mantém a playlist rodando com suavidade mesmo em oscilações
                      momentâneas da conexão com a internet.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Projetado para ambientes corporativos que exigem alta estabilidade</span>
                  <span>Slide 5</span>
                </div>
              </div>
            )}

            {/* SLIDE 5: REQUISITOS SIMPLES DE INSTALAÇÃO */}
            {currentSlide === 5 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    O que Você Precisa para Começar?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Instalação descomplicada: sem quebra-quebra de paredes ou cabeamentos caros
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto text-center">
                  <div className="p-5 rounded-xl border border-slate-800 bg-slate-800/80 flex flex-col items-center">
                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
                      <Tv className="h-8 w-8" />
                    </div>
                    <h4 className="text-sm font-bold text-white">1. Qualquer TV ou Monitor</h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Smart TV ou TV com entrada HDMI em qualquer tamanho ou formato.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-800 bg-slate-800/80 flex flex-col items-center">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                      <Wifi className="h-8 w-8" />
                    </div>
                    <h4 className="text-sm font-bold text-white">2. Conexão Wi-Fi ou Cabo</h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Conexão básica de internet banda larga já existente no local.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-800 bg-slate-800/80 flex flex-col items-center">
                    <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                      <Monitor className="h-8 w-8" />
                    </div>
                    <h4 className="text-sm font-bold text-white">3. Dispositivo Reprodutor</h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Uma TV Box Android comum (custo baixo), Smart TV ou Mini PC.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  <div className="text-xs text-slate-200">
                    <strong>Pronto em menos de 15 minutos:</strong> Você conecta o player na TV,
                    insere o código único gerado pela plataforma e a tela já começa a exibir seu conteúdo imediatamente!
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Sem necessidade de comprar painéis industriais dedicados</span>
                  <span>Slide 6</span>
                </div>
              </div>
            )}

            {/* SLIDE 6: FECHAMENTO / PROPOSTA */}
            {currentSlide === 6 && (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
                    Próximos Passos & Demonstração Ao Vivo
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Modernize o atendimento e a comunicação da sua empresa hoje mesmo
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 my-auto">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/80">
                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-400" />
                      Benefícios Imediatos:
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Redução do estresse e confusão na recepção</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Canal de divulgação de produtos de alto retorno</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Percepção de tecnologia e modernidade pelo cliente</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Suporte ágil e atualizações constantes inclusas</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-blue-900/60 bg-blue-950/30 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">
                        Agende uma Demonstração Sem Compromisso
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Colocamos o sistema para rodar em teste na sua tela para que você e sua equipe
                        vejam na prática os benefícios no dia a dia.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-900/60">
                      <p className="text-xs font-bold text-white">
                        {consultantName || 'Consultoria Comercial'}
                      </p>
                      {consultantContact && (
                        <p className="text-xs text-blue-300 mt-0.5">{consultantContact}</p>
                      )}
                      {clientName && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Proposta direcionada para: <strong className="text-white">{clientName}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Mídia Indoor Inteligente & Painel de Chamadas</span>
                  <span>Slide 7 de 7</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Slide Navigation Footer */}
        <div className="border-t border-slate-700 bg-slate-800/90 px-4 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Anterior</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentSlide === idx ? 'w-6 bg-blue-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1))}
            disabled={currentSlide === totalSlides - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Próximo</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
