-- ─────────────────────────────────────────────────────────────
-- Migration: Add Contact Form Detection + Message Templates
-- ─────────────────────────────────────────────────────────────

-- 1. Add contact form detection fields to prospects
ALTER TABLE "prospects" ADD COLUMN "contactFormFields" JSONB;
ALTER TABLE "prospects" ADD COLUMN "hasCaptcha" BOOLEAN;

-- 2. Create message_templates table (with category support)
CREATE TABLE "message_templates" (
  "id" SERIAL PRIMARY KEY,
  "language" TEXT NOT NULL,
  "category" TEXT,  -- Optional category (blogger, media, etc.) - NULL = general template
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("language", "category")
);

-- 3. Insert default templates (9 languages) - All are general templates (category = NULL)
INSERT INTO "message_templates" ("language", "category", "subject", "body", "isDefault") VALUES

-- Français (general template)
('fr', NULL, 'Collaboration partenariat backlink', E'Bonjour,\n\nJe visite régulièrement {siteName} et j''apprécie beaucoup la qualité de votre contenu.\n\nJe suis {yourName}, responsable du développement chez {yourCompany}. Nous avons créé plusieurs ressources gratuites qui pourraient intéresser votre audience :\n\n→ {yourWebsite}\n\nNous proposons un partenariat gagnant-gagnant : si vous mentionnez notre outil dans un article, nous pouvons également promouvoir votre site auprès de notre communauté.\n\nSeriez-vous ouvert(e) à en discuter ?\n\nCordialement,\n{yourName}\n{yourCompany}', TRUE),

-- English (general template)
('en', NULL, 'Partnership opportunity - backlink collaboration', E'Hello,\n\nI regularly visit {siteName} and really appreciate the quality of your content.\n\nI''m {yourName}, partnership manager at {yourCompany}. We''ve created several free resources that might interest your audience:\n\n→ {yourWebsite}\n\nWe''re proposing a win-win partnership: if you mention our tool in an article, we can also promote your site to our community.\n\nWould you be open to discussing this?\n\nBest regards,\n{yourName}\n{yourCompany}', TRUE),

-- Español (general template)
('es', NULL, 'Oportunidad de colaboración - backlinks', E'Hola,\n\nVisito regularmente {siteName} y aprecio mucho la calidad de su contenido.\n\nSoy {yourName}, responsable de desarrollo en {yourCompany}. Hemos creado varios recursos gratuitos que podrían interesar a su audiencia:\n\n→ {yourWebsite}\n\nProponemos una colaboración win-win: si menciona nuestra herramienta en un artículo, también podemos promocionar su sitio a nuestra comunidad.\n\n¿Estaría abierto/a a discutirlo?\n\nSaludos cordiales,\n{yourName}\n{yourCompany}', TRUE),

-- Deutsch (general template)
('de', NULL, 'Partnerschaftsmöglichkeit - Backlink-Zusammenarbeit', E'Hallo,\n\nIch besuche regelmäßig {siteName} und schätze die Qualität Ihrer Inhalte sehr.\n\nIch bin {yourName}, Partnership Manager bei {yourCompany}. Wir haben mehrere kostenlose Ressourcen erstellt, die Ihr Publikum interessieren könnten:\n\n→ {yourWebsite}\n\nWir schlagen eine Win-Win-Partnerschaft vor: Wenn Sie unser Tool in einem Artikel erwähnen, können wir auch Ihre Website in unserer Community bewerben.\n\nWären Sie offen dafür, darüber zu sprechen?\n\nMit freundlichen Grüßen,\n{yourName}\n{yourCompany}', TRUE),

-- Português (general template)
('pt', NULL, 'Oportunidade de parceria - colaboração backlink', E'Olá,\n\nVisito regularmente {siteName} e aprecio muito a qualidade do seu conteúdo.\n\nSou {yourName}, gerente de parcerias na {yourCompany}. Criamos vários recursos gratuitos que podem interessar ao seu público:\n\n→ {yourWebsite}\n\nPropomos uma parceria win-win: se você mencionar nossa ferramenta em um artigo, também podemos promover seu site para nossa comunidade.\n\nVocê estaria aberto(a) a discutir isso?\n\nCordialmente,\n{yourName}\n{yourCompany}', TRUE),

-- Russian (general template)
('ru', NULL, 'Возможность партнерства - сотрудничество по обратным ссылкам', E'Здравствуйте,\n\nЯ регулярно посещаю {siteName} и очень ценю качество вашего контента.\n\nЯ {yourName}, менеджер по партнерствам в {yourCompany}. Мы создали несколько бесплатных ресурсов, которые могут заинтересовать вашу аудиторию:\n\n→ {yourWebsite}\n\nМы предлагаем взаимовыгодное партнерство: если вы упомянете наш инструмент в статье, мы также можем продвигать ваш сайт среди нашего сообщества.\n\nВы были бы открыты для обсуждения этого?\n\nС уважением,\n{yourName}\n{yourCompany}', TRUE),

-- Arabic (general template)
('ar', NULL, 'فرصة شراكة - تعاون الروابط الخلفية', E'مرحبا،\n\nأزور {siteName} بانتظام وأقدر حقًا جودة المحتوى الخاص بك.\n\nأنا {yourName}، مدير الشراكات في {yourCompany}. لقد أنشأنا العديد من الموارد المجانية التي قد تهم جمهورك:\n\n→ {yourWebsite}\n\nنقترح شراكة مربحة للجانبين: إذا ذكرت أداتنا في مقال، يمكننا أيضًا الترويج لموقعك لمجتمعنا.\n\nهل تكون منفتحًا لمناقشة هذا؟\n\nمع أطيب التحيات,\n{yourName}\n{yourCompany}', TRUE),

-- Chinese (general template)
('zh', NULL, '合作机会 - 反向链接协作', E'您好，\n\n我经常访问{siteName}，非常欣赏您内容的质量。\n\n我是{yourName}，{yourCompany}的合作伙伴经理。我们创建了几个免费资源，可能会让您的受众感兴趣：\n\n→ {yourWebsite}\n\n我们提议一个双赢的合作：如果您在文章中提到我们的工具，我们也可以向我们的社区推广您的网站。\n\n您愿意讨论这个吗？\n\n此致敬礼，\n{yourName}\n{yourCompany}', TRUE),

-- Hindi (general template)
('hi', NULL, 'साझेदारी का अवसर - बैकलिंक सहयोग', E'नमस्ते,\n\nमैं नियमित रूप से {siteName} पर जाता हूं और आपकी सामग्री की गुणवत्ता की सराहना करता हूं।\n\nमैं {yourName} हूं, {yourCompany} में साझेदारी प्रबंधक। हमने कई मुफ्त संसाधन बनाए हैं जो आपके दर्शकों को रुचि दे सकते हैं:\n\n→ {yourWebsite}\n\nहम एक जीत-जीत साझेदारी का प्रस्ताव करते हैं: यदि आप एक लेख में हमारे उपकरण का उल्लेख करते हैं, तो हम आपकी साइट को अपने समुदाय में भी बढ़ावा दे सकते हैं।\n\nक्या आप इस पर चर्चा करने के लिए खुले होंगे?\n\nसादर,\n{yourName}\n{yourCompany}', TRUE);

-- 4. Create indexes
CREATE INDEX "message_templates_language_idx" ON "message_templates"("language");
CREATE INDEX "message_templates_category_idx" ON "message_templates"("category");
CREATE INDEX "message_templates_isDefault_idx" ON "message_templates"("isDefault");
