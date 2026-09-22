/* ACM PSU — Arabic / English switching.
 *
 * The site is authored in English; this layer swaps the rendered text at
 * runtime rather than duplicating every page into an /ar directory. It walks
 * the DOM's text nodes and the user-visible attributes, looks each up in the
 * dictionary below, and writes the Arabic in place — keeping the English in a
 * WeakMap so switching back is exact.
 *
 * Anything absent from the dictionary is left alone on purpose. That is how the
 * terminal-styled tokens (IDs like 0x26_JAM, file names, SHA hashes, DIR paths,
 * ACM{...} flag format) stay identical in both languages.
 *
 * TO TRANSLATE NEW COPY: add "English source": "Arabic" to DICT below. Matching
 * ignores surrounding and repeated whitespace, so wrapped paragraphs can be
 * written on one line here. Text broken up by inline elements (<b>, <span>)
 * arrives as several separate text nodes, so each fragment needs its own entry.
 *
 * Dynamic content (the team-year roster, project filtering, the archive file
 * browser) is rendered by other scripts after this one runs, so a
 * MutationObserver re-applies the translation to anything newly inserted.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "acm-lang";

  var DICT = {
    /* --- Navigation and chrome, shared across pages --- */
    "Skip to content": "تخطَّ إلى المحتوى",
    "ACM PSU — home": "ACM PSU — الصفحة الرئيسية",
    "Toggle navigation": "إظهار القائمة",
    About: "عن النادي",
    Team: "الأعضاء",
    Projects: "المشاريع",
    Opportunities: "الفرص",
    Positions: "المهام",
    Archive: "الأرشيف",
    Join: "انضم إلينا",
    Portal: "البوابة",
    Contact: "تواصل معنا",
    "Ask us anything": "اسألنا أي شيء",
    "Digital Archive": "الأرشيف الرقمي",
    "SYS.ARCHIVE_": "الأرشيف_",
    "// ONLINE": "// متصل",
    "SYS.ARCHIVE // 404": "الأرشيف // 404",
    "STATUS: ENROLLMENT_OPEN": "الحالة: التسجيل_مفتوح",
    "STATUS: RECRUITING": "الحالة: استقبال_المتطوعين",

    /* --- Footer --- */
    "ACM PRINCE SULTAN UNIVERSITY": "ACM جامعة الأمير سلطان",
    "Prince Sultan University": "جامعة الأمير سلطان",
    "College of Computer and Information Sciences":
      "كلية علوم الحاسب والمعلومات",
    "College of Computer & Information Sciences": "كلية علوم الحاسب والمعلومات",
    "RENDERED:": "وقت العرض:",
    "DIRECTORY_STATUS:": "حالة_الدليل:",
    COMMITTED: "مُثبّت",
    "RECORDS SHOWN:": "السجلات المعروضة:",
    "AUTH_SESSION:": "الجلسة:",
    GUEST_USER: "زائر",

    /* --- Home --- */
    "ACM PSU — Digital Archive": "ACM جامعة الأمير سلطان — الأرشيف الرقمي",
    "ACM.PSU / CURRENT CHAPTER /": "ACM.PSU / الدفعة الحالية /",
    "Association for Computing Machinery.": "جمعية آلات الحاسب (ACM).",
    "The ACM student chapter at the College of Computer & Information Sciences. We run programming and cybersecurity competitions, teach the workshops that lead into them, and keep the record of every chapter that came before. This is our digital archive.":
      "نادي ACM الطلابي في كلية علوم الحاسب والمعلومات. ننظّم مسابقات في البرمجة والأمن السيبراني، ونقدّم الورش التي تُهيّئ لها، ونحفظ سجل كل دفعة سبقتنا. هذا هو أرشيفنا الرقمي.",
    "Explore Projects": "تصفّح المشاريع",
    "Join ACM": "انضم إلى ACM",

    Charter: "ميثاق النادي",
    "CCIS // OFFICIAL CHAPTER MANDATE":
      "كلية علوم الحاسب والمعلومات // التفويض الرسمي للنادي",
    MISSION: "الرسالة",
    "Bridging academia and industry for computing students.":
      "نجسر المسافة بين الأكاديميا والصناعة لطلبة الحوسبة.",
    "The PSU ACM Student Chapter is a platform for professional development, new ideas and working together. It exists to close the gap between university and industry, and to build a community where students can grow, learn and contribute to computing more widely.":
      "نادي ACM الطلابي في جامعة الأمير سلطان منصة للتطوير المهني والأفكار الجديدة والعمل المشترك. غايته تقريب المسافة بين الجامعة والقطاع، وبناء مجتمع ينمو فيه الطلبة ويتعلّمون ويسهمون في مجال الحوسبة على نطاق أوسع.",
    "CHARTERED UNDER": "يتبع لـ",
    "CHAPTER CHAIRS": "رؤساء النادي الأكاديميون",
    CHAPTER_CHAIRS: "رؤساء_النادي",
    "CHAPTER EMAIL": "بريد النادي",
    "Dr. Yasir Javed · Dr. Souad Larabi-Marie-Sainte":
      "د. ياسر جاويد · د. سعاد العربي ماري سانت",
    "Talks and discussions": "المحاضرات وحلقات النقاش",
    "Open the door to talks, panel discussions and conferences that build the professional skills students need after graduation.":
      "فتح الباب أمام المحاضرات وحلقات النقاش والمؤتمرات التي تبني المهارات المهنية التي يحتاجها الطلبة بعد التخرج.",
    "Writing and research": "الكتابة والبحث",
    "Give students the chance to write and present technical reports, and to work together on research projects.":
      "إتاحة الفرصة للطلبة لكتابة التقارير التقنية وتقديمها، وللعمل معًا في مشاريع بحثية.",
    "New ideas": "الأفكار الجديدة",
    "Back new computing programmes and give students room to build things together.":
      "دعم البرامج الحاسوبية الجديدة وإتاحة المجال للطلبة ليبنوا معًا.",
    "University and industry": "الجامعة والقطاع",
    "Close the gap between university and industry, and put students in front of employers and the people leading the field.":
      "تقريب المسافة بين الجامعة والقطاع، ووضع الطلبة أمام أرباب العمل وقادة المجال.",
    "People and mentorship": "التواصل والإرشاد",
    "Create chances to meet people, find mentors and keep learning outside the classroom by trading ideas and experience.":
      "إتاحة فرص للتعرّف على الناس وإيجاد مرشدين ومواصلة التعلّم خارج قاعة الدرس عبر تبادل الأفكار والخبرات.",

    "Faculty Advisors": "المشرفون الأكاديميون",
    "FACULTY ADVISOR": "مشرف أكاديمي",
    "Dr. Souad Larabi-Marie-Sainte": "د. سعاد العربي ماري سانت",
    "Dr. Yasir Javed": "د. ياسر جاويد",
    COLLEGE: "الكلية",
    EMAIL: "البريد الإلكتروني",

    "System Focus": "مجالات تركيزنا",
    "CORE COMPETENCIES // V.26": "التخصصات الأساسية // إصدار 26",
    "AI-Assisted Engineering": "الهندسة بمساعدة الذكاء الاصطناعي",
    "PLAN, BUILD, DEBUG, DEPLOY": "تخطيط، بناء، تصحيح، إطلاق",
    "Full-Stack Web": "تطوير الويب المتكامل",
    "FIREBASE, GITHUB, VERCEL, CLOUDFLARE":
      "FIREBASE، GITHUB، VERCEL، CLOUDFLARE",
    "Cybersecurity (CTF)": "الأمن السيبراني (CTF)",
    "CRYPTOGRAPHY, WEB, FORENSICS, OSINT":
      "التشفير، الويب، التحليل الجنائي، الاستخبارات المفتوحة",
    "Workshops & Competitions": "الورش والمسابقات",
    "TEACH FIRST, THEN COMPETE": "نُعلّم أولًا، ثم نتنافس",

    "Current Generation": "الدفعة الحالية",
    "STATUS: ACTIVE CHAPTER": "الحالة: دفعة نشطة",
    "Muhammad Yawar Hayat": "محمد ياور حياة",
    "Shoug Alomran": "شوق العمران",
    President: "رئيس النادي",
    "Vice President": "نائبة الرئيس",
    "View Complete Roster": "عرض القائمة الكاملة",

    "Selected Work": "أعمال مختارة",
    "BUILT BY ACM // PRODUCTION ENV": "من تنفيذ ACM // بيئة تشغيل فعلية",
    PROJECT_ID: "رقم_المشروع",
    COMPETITION_DAY: "يوم_المسابقة",
    "ACM Programming Jam 2026": "معسكر ACM للبرمجة 2026",
    "An AI-assisted web engineering competition. Every team receives the same application brief, then plans it in Excalidraw, designs it, builds it with AI assistants and Firebase, ships it to Vercel behind a real domain, absorbs a mid-competition change request, and presents the result. Three preparation workshop days run 15–17 September; the brief stays locked until competition day.":
      "مسابقة في هندسة الويب بمساعدة الذكاء الاصطناعي. يستلم كل فريق الوصف نفسه للتطبيق المطلوب، ثم يخطّط له في Excalidraw، ويصمّمه، ويبنيه بأدوات الذكاء الاصطناعي وFirebase، وينشره على Vercel تحت نطاق حقيقي، ويستوعب طلب تغيير في منتصف المسابقة، ثم يقدّم النتيجة. تسبقها ثلاثة أيام من الورش التحضيرية من 15 إلى 17 سبتمبر، ويبقى وصف المشروع سريًا حتى يوم المسابقة.",
    "Case Study": "دراسة الحالة",
    "Event Guide": "دليل الفعالية",
    "Event Site": "موقع الفعالية",
    "ACM/CyberTech CTF 3.0": "مسابقة ACM/CyberTech CTF 3.0",
    "A three-hour jeopardy-style Capture The Flag run jointly with the CyberTech Club. Four attack vectors — cryptography, web, forensics and OSINT — scaled from Very Easy to Insane. Teams of two to three submit flags in":
      "مسابقة التقاط الأعلام على مدى ثلاث ساعات بنظام Jeopardy، تُقام بالشراكة مع نادي CyberTech. أربعة مسارات — التشفير، والويب، والتحليل الجنائي، والاستخبارات مفتوحة المصدر — بمستويات صعوبة تتدرّج من السهل جدًا إلى الجنوني. تتنافس فرق من فردين إلى ثلاثة بإرسال الأعلام بصيغة",
    "format for points on a live scoreboard. Saturday 24 October 2026, 10:00–13:00, Auditorium B105.":
      "لكسب النقاط على لوحة نتائج مباشرة. السبت 24 أكتوبر 2026، من 10:00 إلى 13:00، قاعة B105.",
    "CTF 2.0 Results": "نتائج CTF 2.0",

    "Club Collaborations": "التعاون مع الأندية",
    "SHARED PROJECTS // DOCUMENTED HISTORY": "مشاريع مشتركة // تاريخ موثّق",
    "Building PSU's Capture The Flag series together.":
      "نبني معًا سلسلة مسابقات التقاط الأعلام في جامعة الأمير سلطان.",
    "The ACM Club and CyberTech Club collaborate on the ACM/CyberTech Capture The Flag series at Prince Sultan University. The partnership brings students together around practical cybersecurity training, challenge-based competition and a shared record of each edition. Published materials currently document three editions, from the inaugural CTF 1.0 through the upcoming CTF 3.0.":
      "يتعاون ناديا ACM وCyberTech في تنظيم سلسلة مسابقات ACM/CyberTech لالتقاط الأعلام في جامعة الأمير سلطان. تجمع هذه الشراكة الطلاب حول التدريب العملي في الأمن السيبراني، والمنافسة القائمة على التحديات، وتوثيق مشترك لكل نسخة. توثّق المواد المنشورة حاليًا ثلاث نسخ، بدءًا من CTF 1.0 الافتتاحية وحتى CTF 3.0 القادمة.",
    "Explore CTF 3.0": "استكشف CTF 3.0",
    "View CTF 2.0 Results": "عرض نتائج CTF 2.0",
    COLLABORATORS: "الجهات المتعاونة",
    "ACM CLUB × CYBERTECH CLUB": "نادي ACM × نادي CYBERTECH",
    MILESTONE: "المحطة",
    "INAUGURAL JOINT CTF": "أول مسابقة CTF مشتركة",
    "ARCHIVE MATERIAL PENDING": "مواد الأرشيف قيد الانتظار",
    "PAST EDITION": "نسخة سابقة",
    "VERIFIED OUTCOME": "نتيجة موثّقة",
    "11 TEAMS // 852 SUBMISSIONS // HZ WON":
      "11 فريقًا // 852 محاولة // فوز HZ",
    "PUBLIC RECORD": "السجل العام",
    "RESULTS + PRIVACY-SAFE REPORT": "النتائج + تقرير يحمي الخصوصية",
    "CURRENT PROGRAMME": "البرنامج الحالي",
    "04 TRAINING TRACKS + CAPTURE THE FLAG":
      "04 مسارات تدريبية + مسابقة التقاط الأعلام",
    COMPETITION: "المسابقة",
    "24 OCT 2026 // AUDITORIUM B105": "24 أكتوبر 2026 // قاعة B105",
    ACTIVE: "نشط",
    "The Collaboration": "الشراكة",
    "A continuing joint series": "سلسلة مشتركة مستمرة",
    "CTF 3.0 continues the Capture The Flag series organized jointly by the ACM Club and CyberTech Club at Prince Sultan University's College of Computer and Information Sciences. The collaboration connects ACM's wider computing community with CyberTech's cybersecurity focus in one practical programme.":
      "تواصل CTF 3.0 سلسلة مسابقات التقاط الأعلام التي ينظمها ناديا ACM وCyberTech معًا في كلية علوم الحاسب والمعلومات بجامعة الأمير سلطان. تجمع الشراكة مجتمع ACM الأوسع في الحوسبة مع تركيز CyberTech على الأمن السيبراني ضمن برنامج عملي واحد.",
    "Training before competition": "التدريب قبل المنافسة",
    "The shared programme is broader than competition day. Preparation workshops introduce the same four domains used in the CTF—cryptography, web security, digital forensics and OSINT—before participants enter the cyber range.":
      "يمتد البرنامج المشترك إلى ما هو أبعد من يوم المسابقة. تعرّف الورش التحضيرية بالمجالات الأربعة المستخدمة في CTF — التشفير، وأمن الويب، والتحليل الجنائي الرقمي، والاستخبارات مفتوحة المصدر — قبل دخول المشاركين إلى الميدان السيبراني.",
    "A record across editions": "سجل يمتد عبر النسخ",
    "The archive identifies CTF 1.0 as the inaugural joint edition, preserves verified results and aggregate analytics from CTF 2.0, and documents the schedule and format of CTF 3.0 as the current collaboration.":
      "يوثّق الأرشيف CTF 1.0 بوصفها النسخة المشتركة الافتتاحية، ويحفظ النتائج الموثّقة والتحليلات الإجمالية من CTF 2.0، ويسجّل جدول وصيغة CTF 3.0 بوصفها الشراكة الحالية.",
    "Open the collaboration archive": "افتح أرشيف الشراكة",

    "Archive Directory": "دليل الأرشيف",
    "HISTORICAL DATA // READ-ONLY": "بيانات تاريخية // للقراءة فقط",
    "FLAGSHIP EVENTS": "الفعاليات الرئيسية",
    "WORKSHOP DAYS": "أيام الورش",
    "07 SCHEDULED": "07 مجدولة",
    LEADERSHIP: "القيادة",
    "M. Y. HAYAT": "م. ي. حياة",
    "ACTIVE CHAPTER": "دفعة نشطة",
    "TEAMS RANKED": "الفرق المصنّفة",
    SUBMISSIONS: "المحاولات",
    "852 // 89 CAPTURED": "852 // 89 علمًا",
    WINNER: "الفائز",
    "HZ — 3,800 PTS": "HZ — 3,800 نقطة",
    "RESULTS VERIFIED": "النتائج موثّقة",
    EDITION: "النسخة",
    "FIRST ACM/CYBERTECH CTF": "أول مسابقة ACM/CYBERTECH",
    RECORDS: "السجلات",
    "NOT YET DIGITISED": "لم تُؤرشف بعد",
    STATUS: "الحالة",
    "ARCHIVE PENDING": "بانتظار الأرشفة",
    ARCHIVED: "مؤرشَف",
    "Open the CTF 2.0 Results Archive": "افتح أرشيف نتائج CTF 2.0",
    "Browse the JAM.26 Resource Archive": "تصفّح أرشيف موارد JAM.26",

    "SYS.MSG: EOF NOT REACHED": "رسالة النظام: لم نبلغ النهاية بعد",
    "The Archive Isn't Finished.": "الأرشيف لم يكتمل بعد.",
    "Your code, your designs, your leadership could define the next block.":
      "كودك، وتصاميمك، وقيادتك قد تكون هي الفصل القادم في هذا الأرشيف.",
    "Initialize Membership": "ابدأ عضويتك",

    /* --- Team --- */
    "People / 2026 — ACM PSU": "الأعضاء / 2026 — ACM جامعة الأمير سلطان",
    DIRECTORY: "الدليل",
    PEOPLE: "الأعضاء",
    People: "الأعضاء",
    GEN_2026: "دفعة_2026",
    "Executive Council": "المجلس التنفيذي",
    "LEVEL_01 // ADMINISTRATION": "المستوى_01 // الإدارة",
    PRESIDENT: "رئيس النادي",
    "VICE PRESIDENT": "نائبة الرئيس",
    "General Assembly": "الجمعية العمومية",
    "PEOPLE / PROFILE": "الأعضاء / الملف الشخصي",
    "Member profile": "الملف الشخصي للعضو",
    Role: "الدور",
    Major: "التخصص",
    College: "الكلية",
    Chapter: "الدفعة",
    "ACM service": "الخدمة في ACM",
    "Record ID": "معرّف السجل",
    "RECORD:": "السجل:",
    "Current chapter": "الدفعة الحالية",
    BIO: "نبذة",
    "ROLE PROGRESSION": "التدرّج في الأدوار",
    "CONNECTED SYSTEMS": "الروابط والمنصات",
    "Close profile": "إغلاق الملف الشخصي",
    "BLUEPRINT ↗": "بلو برنت ↗",
    "LEVEL_02 // ROSTER PENDING": "المستوى_02 // القائمة قيد الإعداد",
    "Committee roster in progress": "قائمة اللجان قيد الإعداد",
    "GEN_2026 // ORGANISING COMMITTEE NOT YET PUBLISHED":
      "دفعة_2026 // لم تُنشر اللجنة المنظّمة بعد",
    "Names and roles for the JAM.26 and CTF 3.0 organising committees are confirmed as each event team is finalised. If you are on a committee and want your entry added, send your name, role and photo to the chapter board.":
      "تُعتمد أسماء وأدوار اللجان المنظّمة لمعسكر JAM.26 ومسابقة CTF 3.0 فور اكتمال فريق كل فعالية. إذا كنت عضوًا في إحدى اللجان وترغب بإضافة بياناتك، أرسل اسمك ودورك وصورتك إلى مجلس إدارة النادي.",
    "HISTORICAL RECURSION // SELECT PREVIOUS GENERATION":
      "أرشيف الدفعات // اختر دفعة سابقة",
    "Select chapter year": "اختر سنة الدفعة",
    "2026 — CURRENT CHAPTER": "2026 — الدفعة الحالية",
    "2025 — NO RECORDS": "2025 — لا توجد سجلات",
    "2024 — NO RECORDS": "2024 — لا توجد سجلات",
    "2023 — NO RECORDS": "2023 — لا توجد سجلات",
    "2022 — NO RECORDS": "2022 — لا توجد سجلات",
    "ORIGIN_2016 — NO RECORDS": "التأسيس_2016 — لا توجد سجلات",
    ORIGIN_2016: "التأسيس_2016",
    "Roster not yet digitised": "لم تُؤرشف قائمة هذه الدفعة بعد",
    "If you have photos or a member list from this chapter, send them to the committee and we will add them.":
      "إذا كان لديك صور أو قائمة بأعضاء هذه الدفعة، أرسلها إلى اللجنة وسنضيفها إلى الأرشيف.",

    /* --- Projects --- */
    "Technical Collection — ACM PSU":
      "المجموعة التقنية — ACM جامعة الأمير سلطان",
    "Workshop Resource Archive": "أرشيف موارد الورش",
    "03 DAYS // 14 DOCUMENTS": "03 أيام // 14 مستندًا",
    "The working library behind JAM.26: participant-facing lessons and checklists, instructor planning records, and reusable templates for future workshops and competitions. Draft planning files are labeled separately from published learning material so participants can tell what is ready to use.":
      "المكتبة العملية خلف JAM.26: دروس وقوائم تحقق للمشاركين، وسجلات تخطيط للمدربين، وقوالب قابلة لإعادة الاستخدام في الورش والمسابقات المستقبلية. تُصنّف ملفات التخطيط الأولية بصورة منفصلة عن المواد التعليمية المنشورة حتى يعرف المشاركون ما هو جاهز للاستخدام.",
    "Participant Learning Material": "مواد تعلم المشاركين",
    PUBLISHED: "منشور",
    "Planning & Development Workflow": "التخطيط ومسار التطوير",
    "Requirements, Excalidraw system mapping, Variant UI planning, local tooling, Git/GitHub and responsible AI-assisted implementation.":
      "المتطلبات، ورسم النظام في Excalidraw، وتخطيط الواجهة في Variant، وأدوات التطوير المحلية، وGit/GitHub، والتنفيذ المسؤول بمساعدة الذكاء الاصطناعي.",
    "Read lesson": "اقرأ الدرس",
    "Checklist PDF": "قائمة التحقق PDF",
    "Full-Stack Development & Debugging": "تطوير Full-Stack وتصحيح الأخطاء",
    "Firebase Authentication, Firestore persistence, user-owned data, security rules, browser evidence and systematic debugging.":
      "مصادقة Firebase، واستمرارية البيانات في Firestore، وملكية المستخدم للبيانات، وقواعد الأمان، وأدلة المتصفح، والتصحيح المنهجي.",
    "Deployment, Discovery & Optimization": "النشر والاكتشاف والتحسين",
    "Vercel deployment, Cloudflare DNS, production verification, search discovery, PageSpeed analysis and production debugging.":
      "النشر عبر Vercel، وDNS عبر Cloudflare، والتحقق من بيئة الإنتاج، واكتشاف البحث، وتحليل PageSpeed، وتصحيح مشكلات الإنتاج.",
    "Instructor Workshop Plans": "خطط الورش للمدربين",
    "WORKING DRAFTS": "مسودات عمل",
    "These filled planning records contain objectives, prerequisites, preparation tasks, lesson timing, demonstrations, exercises, prompt examples, troubleshooting guidance and post-workshop review fields. “TBD” and “Not Started” values remain part of the source planning documents.":
      "تحتوي سجلات التخطيط المعبأة على الأهداف والمتطلبات السابقة ومهام التحضير وتوقيت الدروس والعروض والتمارين وأمثلة الأوامر وإرشادات معالجة المشكلات وحقول مراجعة ما بعد الورشة. تبقى قيم «يحدد لاحقًا» و«لم يبدأ» جزءًا من مستندات التخطيط الأصلية.",
    "Planning record · PDF": "سجل تخطيط · PDF",
    "Reusable Project Templates": "قوالب مشاريع قابلة لإعادة الاستخدام",
    "BLANK TEMPLATES": "قوالب فارغة",
    "Blank structures for future ACM projects. These are working templates rather than event announcements; placeholder fields must be completed and reviewed before publication.":
      "هياكل فارغة لمشاريع ACM المستقبلية. هذه قوالب عمل وليست إعلانات فعاليات؛ يجب إكمال الحقول المؤقتة ومراجعتها قبل النشر.",
    Workshop: "ورشة",
    Judging: "التحكيم",
    Challenge: "التحدي",
    Organizer: "التنظيم",
    "Supplemental Resource": "مورد إضافي",
    "Archive integrity note": "ملاحظة نزاهة الأرشيف",
    "A second copy of the JAM planning files was uploaded under the CTF 3.0 workshop directory. File hashes and content are identical, including the AI web-development curriculum, so those copies are retained as source material but are not published or described as CTF training.":
      "رُفعت نسخة ثانية من ملفات تخطيط JAM داخل دليل ورش CTF 3.0. تتطابق بصمات الملفات ومحتواها، بما في ذلك منهج تطوير الويب بالذكاء الاصطناعي؛ لذلك تُحفظ تلك النسخ كمواد مصدر ولا تُنشر أو توصف كتدريب لمسابقة CTF.",
    Technical: "المجموعة",
    "Collection.": "التقنية.",
    "Filter projects by category": "تصفية المشاريع حسب التصنيف",
    ALL: "الكل",
    JAM: "المعسكر",
    "WEB DEVELOPMENT": "تطوير الويب",
    CTF: "CTF",
    WORKSHOPS: "الورش",
    "Search projects": "ابحث في المشاريع",
    "grep search_projects...": "grep ابحث_في_المشاريع...",
    "COMPETITION: 19 SEP 2026": "المسابقة: 19 سبتمبر 2026",
    "COMPETITION: 24 OCT 2026": "المسابقة: 24 أكتوبر 2026",
    "STATUS: RESULTS VERIFIED": "الحالة: النتائج موثّقة",
    "RUNS: 15–17 SEP 2026": "تُقام: 15–17 سبتمبر 2026",
    "RUNS: 21–22 OCT 2026": "تُقام: 21–22 أكتوبر 2026",
    "An AI-assisted web engineering competition. Every team gets the same brief, then plans, designs, builds, deploys and presents a working application — and adapts to a requirement change mid-competition. Scored out of 100 across seven categories.":
      "مسابقة في هندسة الويب بمساعدة الذكاء الاصطناعي. يستلم كل فريق الوصف نفسه، ثم يخطّط ويصمّم ويبني وينشر ويقدّم تطبيقًا يعمل فعليًا، مع التعامل مع تغيير في المتطلبات أثناء المسابقة. التقييم من 100 درجة موزّعة على سبعة معايير.",
    "Three hours, four attack vectors: cryptography, web, forensics and OSINT. Teams of two to three, difficulty scaled Very Easy through Insane, flags submitted as":
      "ثلاث ساعات وأربعة مسارات: التشفير، والويب، والتحليل الجنائي، والاستخبارات مفتوحة المصدر. فرق من فردين إلى ثلاثة، بمستويات صعوبة من السهل جدًا إلى الجنوني، وتُرسل الأعلام بصيغة",
    "against a live scoreboard. Auditorium B105, 10:00–13:00.":
      "على لوحة نتائج مباشرة. قاعة B105، من 10:00 إلى 13:00.",
    "CTF 2.0 — Results Archive": "CTF 2.0 — أرشيف النتائج",
    "The previous edition, in full: 11 teams, 16+ challenges, 852 flag submissions at a 10.4% solve rate, and a final leaderboard topped by HZ on 3,800 points. Includes per-challenge solve notes and the official competition report.":
      "النسخة السابقة كاملةً: 11 فريقًا، وأكثر من 16 تحديًا، و852 محاولة إرسال بنسبة حل 10.4٪، ولوحة نتائج نهائية تصدّرها فريق HZ بـ 3,800 نقطة. تتضمن ملاحظات الحل لكل تحدٍّ والتقرير الرسمي للمسابقة.",
    "JAM.26 Workshop Programme": "برنامج ورش JAM.26",
    "Three days that walk through the exact workflow used on competition day: planning and requirements, full-stack build and systematic debugging, then deployment, domains, search indexing and PageSpeed measurement. Developed and taught by Shoug Alomran.":
      "ثلاثة أيام تمرّ على مسار العمل نفسه المستخدم يوم المسابقة: التخطيط وتحديد المتطلبات، ثم البناء المتكامل والتصحيح المنهجي، ثم النشر والنطاقات وفهرسة محركات البحث وقياس الأداء عبر PageSpeed. من إعداد وتقديم شوق العمران.",
    "CTF 3.0 Training Workshops": "ورش التدريب على CTF 3.0",
    "Preparation sessions across the four competition categories — web exploitation, applied cryptography, digital forensics and intelligence gathering — so first-time competitors arrive with a working toolkit. Titles and instructors to be announced.":
      "جلسات تحضيرية تغطي مسارات المسابقة الأربعة — استغلال الويب، والتشفير التطبيقي، والتحليل الجنائي الرقمي، وجمع المعلومات — ليصل المتسابقون الجدد بأدوات جاهزة للعمل. تُعلن العناوين والمدرّبون لاحقًا.",
    "AI / WEB": "ذكاء اصطناعي / ويب",
    CYBERSECURITY: "الأمن السيبراني",
    WORKSHOP: "ورشة عمل",
    ARCHIVE: "أرشيف",
    "View Case Study": "عرض دراسة الحالة",
    "View Event Guide": "عرض دليل الفعالية",
    "Open Event Site": "افتح موقع الفعالية",
    "View Results": "عرض النتائج",
    "Open Resource Archive": "افتح أرشيف الموارد",
    "NO RECORDS MATCH THIS QUERY.": "لا توجد سجلات مطابقة لهذا البحث.",
    "ACM Programming Jam 2026 banner": "لافتة معسكر ACM للبرمجة 2026",
    "ACM/CyberTech CTF 3.0 banner": "لافتة مسابقة ACM/CyberTech CTF 3.0",
    "CTF 2.0 final scoreboard": "لوحة النتائج النهائية لمسابقة CTF 2.0",

    /* --- Open positions --- */
    "Open Positions — ACM PSU": "المهام المتاحة — ACM جامعة الأمير سلطان",
    "Choose Your": "اختر مجال",
    "Contribution.": "مساهمتك.",
    "Every opening shows the same information to every member: the work, requirements, commitment, capacity, deadline, and selection method. Places are confirmed by the server in submission order.":
      "تُعرض المعلومات نفسها لكل عضو في كل مهمة: العمل المطلوب، والمتطلبات، والالتزام، والسعة، والموعد النهائي، وطريقة الاختيار. يؤكد النظام المقاعد حسب ترتيب وصول الطلبات.",
    FAIR_ACCESS_PROTOCOL: "بروتوكول_الفرص_العادلة",
    "Members may apply to more than one role. Registration closes automatically at capacity, and organizers may enable a timestamped waitlist.":
      "يمكن للأعضاء التقديم إلى أكثر من دور واحد. يُغلق التسجيل تلقائيًا عند اكتمال العدد، ويمكن للمنظمين تفعيل قائمة انتظار مؤرخة.",
    "LIVE REGISTRY": "السجل المباشر",
    "Open assignments": "المهام المتاحة",
    "Refresh availability": "تحديث المقاعد",
    "CONNECTING TO ASSIGNMENT REGISTRY...": "جارٍ الاتصال بسجل المهام...",
    "REGISTRY NOT CONFIGURED — follow apps-script/SETUP.md to connect the positions sheet.":
      "لم يُربط سجل المهام بعد — اتبع ملف apps-script/SETUP.md لربط الجدول.",
    Responsibilities: "المسؤوليات",
    Requirements: "المتطلبات",
    Commitment: "الالتزام",
    Deadline: "الموعد النهائي",
    Selection: "طريقة الاختيار",
    "Sign up for assignment": "سجّل في المهمة",
    "Registration closed": "التسجيل مغلق",
    "Join waitlist": "انضم لقائمة الانتظار",
    "Claim position": "طلب المهمة",
    "Full name": "الاسم الكامل",
    "PSU email": "البريد الجامعي",
    "Why are you interested?": "لماذا تهتم بهذه المهمة؟",
    "MAX 600 CHARACTERS": "600 حرف كحد أقصى",
    "Briefly explain your interest and any relevant experience.":
      "اشرح باختصار اهتمامك وأي خبرة ذات صلة.",
    "I have read the responsibilities, availability, and time commitment, and I can complete this assignment.":
      "قرأت المسؤوليات والمقاعد المتاحة والالتزام الزمني، ويمكنني إكمال هذه المهمة.",
    "Submit assignment request": "إرسال طلب المهمة",
    "NO OPEN ASSIGNMENTS": "لا توجد مهام متاحة",
    "Check back when the next project sprint begins.":
      "تحقق مجددًا عند بدء مرحلة المشروع القادمة.",

    /* --- Join --- */
    "Initialize Membership — ACM PSU": "ابدأ عضويتك — ACM جامعة الأمير سلطان",
    "[ ACTION: INITIALIZE_MEMBERSHIP ]": "[ الإجراء: بدء_العضوية ]",
    "Join the Collective": "انضم إلى التجمّع",
    "ACM PSU is looking for the next generation of engineers, researchers, and hackers. Complete the handshake protocol below to apply for the 2026 cohort.":
      "نادي ACM في جامعة الأمير سلطان يبحث عن الجيل القادم من المهندسين والباحثين والمبرمجين. أكمل النموذج أدناه للتقديم على دفعة 2026.",
    "Full Name": "الاسم الكامل",
    STR_REQ: "حقل_مطلوب",
    "e.g. Faisal Al-Dosari": "مثال: فيصل الدوسري",
    "PSU Email": "البريد الجامعي",
    EMAIL_VALIDATE: "بريد_إلكتروني",
    "Student ID": "الرقم الجامعي",
    ID_REQ: "رقم_مطلوب",
    "e.g. 221100234": "مثال: 221100234",
    Major: "التخصص",
    "e.g. Computer Science": "مثال: علوم الحاسب",
    "Academic Year": "السنة الدراسية",
    "Select Year": "اختر السنة",
    "Freshman (Y1)": "السنة الأولى",
    "Sophomore (Y2)": "السنة الثانية",
    "Junior (Y3)": "السنة الثالثة",
    "Senior (Y4)": "السنة الرابعة",
    Graduate: "دراسات عليا",
    "What are you interested in?": "ما الذي يهمّك؟",
    "Select Core": "اختر المجال",
    "Select an interest": "اختر اهتمامًا",
    "Technical tracks": "المسارات التقنية",
    "Club contribution roles": "أدوار المساهمة في النادي",
    "SELECT ALL THAT APPLY": "اختر كل ما ينطبق",
    "SELECT AT LEAST ONE INTEREST.": "اختر اهتمامًا واحدًا على الأقل.",
    "Software Engineering": "هندسة البرمجيات",
    Cybersecurity: "الأمن السيبراني",
    "AI / Data Science": "الذكاء الاصطناعي / علم البيانات",
    "Competitive Programming": "البرمجة التنافسية",
    "UI/UX Design": "تصميم تجربة المستخدم",
    "Workshop Content Development": "إعداد محتوى الورش",
    "Workshop Presenting / Teaching": "تقديم الورش / التدريب",
    "Content Writing / Social Media": "كتابة المحتوى / التواصل الاجتماعي",
    "Graphic Design / Branding": "التصميم الجرافيكي / الهوية البصرية",
    "Photography / Video Production": "التصوير / إنتاج الفيديو",
    "Event Planning / Operations": "تخطيط الفعاليات / التشغيل",
    "Community Outreach / Partnerships": "التواصل المجتمعي / الشراكات",
    "Website / Technical Support": "الموقع الإلكتروني / الدعم التقني",
    "LinkedIn / GitHub / Portfolio": "لينكدإن / GitHub / معرض الأعمال",
    OPTIONAL: "اختياري",
    "What would you like to gain experience in?":
      "في أي مجال تودّ اكتساب الخبرة؟",
    "Briefly describe your interests and what you hope to contribute...":
      "اكتب باختصار عن اهتماماتك وما تطمح إلى الإسهام به...",
    "Leave this field empty": "اترك هذا الحقل فارغًا",
    "Execute Handshake [Enter]": "إرسال الطلب [Enter]",

    MEMBERSHIP_BENEFITS: "مزايا_العضوية",
    "Access to": "الوصول إلى",
    "ACM Lab Hardware": "أجهزة مختبر ACM",
    "(GPU clusters, IoT kits).": "(وحدات معالجة رسومية وأطقم إنترنت الأشياء).",
    "Exclusive entry to": "دخول حصري إلى",
    "Member Jams": "معسكرات الأعضاء",
    "and regional ICPC training.": "والتدريب الإقليمي على ICPC.",
    Professional: "شبكة",
    "Network Tunneling": "تواصل مهنية",
    "to PSU alumni at tech giants.": "مع خريجي الجامعة في كبرى شركات التقنية.",
    "Contributor credits on": "توثيق مساهماتك في",
    "ACM Production Systems": "أنظمة ACM التشغيلية",

    FAQ_REGISTRY: "الأسئلة_الشائعة",
    "Do I need prior experience?": "هل أحتاج إلى خبرة سابقة؟",
    "No. We look for curiosity and logical aptitude. If you can learn, you can join.":
      "لا. نبحث عن الفضول والقدرة على التفكير المنطقي. إذا كنت مستعدًا للتعلّم، فمكانك معنا.",
    "What is the time commitment?": "كم يتطلب الالتزام من وقت؟",
    "Standard members commit ~3-5 hours/week for workshops and project sprints.":
      "يخصّص العضو عادةً من 3 إلى 5 ساعات أسبوعيًا للورش ومراحل تنفيذ المشاريع.",
    "Application deadline?": "ما آخر موعد للتقديم؟",
    "Recruitment cycles happen at the start of every semester. Current cycle ends Oct 15.":
      "يفتح باب الانضمام مع بداية كل فصل دراسي. الدورة الحالية تنتهي في 15 أكتوبر.",

    PRE_FLIGHT_CHECK: "تحقق_قبل_الإرسال",
    "[✓] ACTIVE PSU STUDENT ID": "[✓] رقم جامعي فعّال",
    "[✓] PASSION FOR PROBLEM SOLVING": "[✓] شغف بحل المشكلات",
    "[✓] BASIC GIT KNOWLEDGE (PREFERRED)": "[✓] إلمام أساسي بـ Git (يُفضّل)",
    "[ ] FORM SUBMITTED": "[ ] تم إرسال النموذج",

    "TRANSMITTING...": "جارٍ الإرسال...",
    "FORM BACKEND NOT CONFIGURED — applications are not being received yet. Please email acmchapter@psu.edu.sa with your answers in the meantime.":
      "لم يُربط النموذج بعد — الطلبات غير مستلمة حاليًا. يرجى إرسال إجاباتك إلى acmchapter@psu.edu.sa في هذه الأثناء.",
    "HANDSHAKE COMPLETE — application received. We will be in touch.":
      "تم الإرسال بنجاح — استلمنا طلبك وسنتواصل معك قريبًا.",
    "TRANSMISSION FAILED — please retry, or email acmchapter@psu.edu.sa.":
      "فشل الإرسال — يرجى المحاولة مجددًا أو مراسلتنا على acmchapter@psu.edu.sa.",

    /* --- 404 --- */
    "Record Not Found": "الصفحة غير موجودة",
    "The path you requested is not in the archive. It may have been moved, renamed, or never committed.":
      "المسار الذي طلبته غير موجود في الأرشيف. ربما نُقل أو غُيّر اسمه أو لم يُضف أصلًا.",
    "Return to Index": "العودة إلى الرئيسية",

    /* --- Archive project page --- */
    "AI Programming Jam — ACM PSU Archive":
      "معسكر الذكاء الاصطناعي البرمجي — أرشيف ACM",
    "AI Programming Jam": "معسكر الذكاء الاصطناعي البرمجي",
    "An intensive 48-hour competitive programming event focusing on the implementation of generative models and algorithmic efficiency. Includes workshops, official submissions, and event collateral.":
      "فعالية برمجة تنافسية مكثّفة على مدى 48 ساعة، تركّز على بناء النماذج التوليدية وكفاءة الخوارزميات. تشمل الورش والمشاركات الرسمية ومواد الفعالية.",
    "STATUS: ARCHIVED": "الحالة: مؤرشَف",
    "34 FILES": "34 ملفًا",
    "8 DIRECTORIES": "8 مجلدات",
    "LAST UPDATED: 26 SEP 2026": "آخر تحديث: 26 سبتمبر 2026",
    "ALL PROJECTS": "كل المشاريع",
    "Archive sections": "أقسام الأرشيف",
    "ALL FILES": "كل الملفات",
    WEBSITE: "الموقع",
    BRANDING: "الهوية البصرية",
    DOCUMENTS: "المستندات",
    REGISTRATION: "التسجيل",
    RESULTS: "النتائج",
    ALL_FILES: "كل_الملفات",
    "List view": "عرض كقائمة",
    "Grid view": "عرض كشبكة",
    "Search files": "ابحث في الملفات",
    "search_files...": "ابحث_في_الملفات...",
    "Filter files by type": "تصفية الملفات حسب النوع",
    MEDIA: "وسائط",
    LINKS: "روابط",
    "PINNED / 04": "مثبّت / 04",
    "Official Website": "الموقع الرسمي",
    "Competition Rules": "قواعد المسابقة",
    "Workshop Material": "مواد الورش",
    "Final Results": "النتائج النهائية",
    NAME: "الاسم",
    TYPE: "النوع",
    SECTION: "القسم",
    UPDATED: "آخر تحديث",
    SIZE: "الحجم",
    ACT: "إجراء",
    ROOT: "الجذر",
    "12 ITEMS": "12 عنصرًا",
    "45 ITEMS": "45 عنصرًا",
    "8 ITEMS": "8 عناصر",
    "2 ITEMS": "عنصران",
    "NO FILES MATCH THIS QUERY.": "لا توجد ملفات مطابقة لهذا البحث.",
    "FILE PREVIEW": "معاينة الملف",
    "Close preview": "إغلاق المعاينة",
    "Zoom in": "تكبير",
    "Zoom out": "تصغير",
    Type: "النوع",
    Size: "الحجم",
    Uploaded: "تاريخ الرفع",
    Path: "المسار",
    "Adobe PDF": "مستند PDF",
    "HTML Document": "مستند HTML",
    "PNG Image": "صورة PNG",
    "Excel Workbook": "جدول Excel",
    "CSV Document": "ملف CSV",
    "Internet Shortcut": "اختصار إنترنت",
    "PowerPoint Presentation": "عرض PowerPoint",
    "ZIP Archive": "أرشيف ZIP",
    Directory: "مجلد",
    OPEN: "فتح",
    DOWNLOAD: "تنزيل",
    OFFICIAL: "وثيقة",
    DOC: "رسمية",

    /* --- Shared chrome added after the 2026 site revisions --- */
    "MADE BY": "من إعداد",
    "Association for Computing Machinery": "جمعية آلات الحاسب (ACM)",
    PROJECTS: "المشاريع",
    "← All Projects": "→ كل المشاريع",
    "Back to projects": "العودة إلى المشاريع",
    "Return to Projects": "العودة إلى المشاريع",
    "Visit Website ↗": "زيارة الموقع ↗",
    "SOURCE: GITHUB ↗": "المصدر: GITHUB ↗",
    "// RENDERED:": "// وقت العرض:",
    Required: "مطلوب",
    Website: "الموقع الإلكتروني",
    Workshops: "الورش",
    Events: "الفعاليات",
    Competitions: "المسابقات",
    Membership: "العضوية",
    Partnerships: "الشراكات",
    Other: "أخرى",
    Category: "الفئة",
    Email: "البريد الإلكتروني",
    Name: "الاسم",
    Section: "القسم",
    Updated: "آخر تحديث",
    Results: "النتائج",
    Resources: "الموارد",
    Branding: "الهوية البصرية",
    Folders: "المجلدات",
    "All Files": "كل الملفات",
    "Current folder": "المجلد الحالي",
    "File view": "عرض الملفات",
    "File preview": "معاينة الملف",
    "search_all_folders...": "ابحث_في_كل_المجلدات...",
    "Search all files and folders": "ابحث في كل الملفات والمجلدات",
    "Archive files": "ملفات الأرشيف",
    Weight: "الوزن",
    "WebForge 2026 event banner": "لافتة فعالية WebForge 2026",
    "ACM/CyberTech CTF 3.0 event banner": "لافتة مسابقة ACM/CyberTech CTF 3.0",
    "ACM/CyberTech CTF 2.0 event banner": "لافتة مسابقة ACM/CyberTech CTF 2.0",
    "ACM Student Club, Prince Sultan University": "نادي ACM الطلابي، جامعة الأمير سلطان",
    "JAM.26 workshop programme banner": "لافتة برنامج ورش JAM.26",
    "CTF 3.0 workshops banner": "لافتة ورش CTF 3.0",
    "PSU AI Hackathon 2.0": "هاكاثون PSU للذكاء الاصطناعي 2.0",

    /* --- Public AI guide (join and contact) --- */
    "ACM AI Guide": "مساعد ACM الذكي",
    "PUBLIC ASSISTANT": "مساعد عام",
    "Have a question about ACM PSU? Ask here: membership, events, workshops, competitions, the team, or anything else. The guide answers in English or Arabic.":
      "لديك سؤال عن ACM في جامعة الأمير سلطان؟ اسأل هنا عن العضوية أو الفعاليات أو الورش أو المسابقات أو الفريق أو أي شيء آخر. يجيب المساعد بالعربية أو الإنجليزية.",
    "DO I NEED EXPERIENCE?": "هل أحتاج إلى خبرة؟",
    "HOW DO I JOIN?": "كيف أنضم؟",
    "WHICH ROLE FITS ME?": "أي دور يناسبني؟",
    "EVENTS WITHOUT MEMBERSHIP?": "فعاليات بلا عضوية؟",
    "UPCOMING EVENTS": "الفعاليات القادمة",
    "ACM GUIDE": "مساعد ACM",
    "Hi! Ask me anything: joining ACM PSU, upcoming events, past competitions, the team, or how to get started in computing. You can ask in English or Arabic.":
      "مرحبًا! اسألني عن أي شيء: الانضمام إلى ACM في جامعة الأمير سلطان، أو الفعاليات القادمة، أو المسابقات السابقة، أو الفريق، أو كيف تبدأ في مجال الحوسبة. يمكنك السؤال بالعربية أو الإنجليزية.",
    "Ask the ACM AI Guide": "اسأل مساعد ACM الذكي",
    ASK: "اسأل",
    "AI GUIDE // PUBLIC INFORMATION ONLY. DO NOT SHARE PASSWORDS, STUDENT IDS OR SENSITIVE INFORMATION. FOR COMMITTEE DECISIONS, USE THE CONTACT FORM.":
      "المساعد الذكي // معلومات عامة فقط. لا تشارك كلمات المرور أو الأرقام الجامعية أو أي معلومات حساسة. لقرارات اللجنة، استخدم نموذج التواصل.",
    "Suggested questions": "أسئلة مقترحة",
    "Ask anything about ACM PSU…":
      "اسأل أي شيء عن ACM PSU…",

    /* --- Home --- */
    "ACM × CYBERTECH": "ACM × CYBERTECH",
    "Browse the WebForge Resource Archive": "تصفّح أرشيف موارد WebForge",
    "An AI-assisted web engineering competition. Every team receives the same application brief, then plans it in Excalidraw, designs it, builds it with AI assistants, deploys it and presents it — adapting when the requirements change mid-competition.":
      "مسابقة في هندسة الويب بمساعدة الذكاء الاصطناعي. يستلم كل فريق الوصف نفسه للتطبيق المطلوب، ثم يخطّط له في Excalidraw، ويصمّمه، ويبنيه بأدوات الذكاء الاصطناعي، وينشره ويعرضه — ويتكيّف حين تتغيّر المتطلبات أثناء المسابقة.",

    /* --- Join --- */
    "ACM PSU is looking for the next generation of engineers, researchers, and hackers. Complete the handshake protocol below to apply for the current cohort.":
      "نادي ACM في جامعة الأمير سلطان يبحث عن الجيل القادم من المهندسين والباحثين والمبرمجين. أكمل الخطوات أدناه للتقديم على الدفعة الحالية.",
    "STEP_01 // CREATE AN ACCOUNT": "الخطوة_01 // أنشئ حسابًا",
    "Applications are made from your own ACM account, so you can check on your application, and so your member dashboard is ready the moment you are accepted.":
      "يُقدَّم الطلب من حسابك في ACM، لتتابع طلبك بنفسك، وتجد لوحة العضو جاهزة لحظة قبولك.",
    "STEP_02 // SUBMIT THE APPLICATION": "الخطوة_02 // أرسل الطلب",
    "Name, student ID, PSU email, major, academic year and what you would like to get experience in. It takes a couple of minutes.":
      "الاسم، والرقم الجامعي، والبريد الجامعي، والتخصص، والسنة الدراسية، والمجال الذي تودّ اكتساب الخبرة فيه. يستغرق الأمر دقيقتين.",
    "No technical experience is required": "لا تُشترط أي خبرة تقنية",
    "— the club exists to give you that experience, not to test for it.":
      "— وُجد النادي ليمنحك هذه الخبرة، لا ليختبرك فيها.",
    "STEP_03 // WE READ IT": "الخطوة_03 // نقرأ طلبك",
    "An organiser reviews every application. Some applicants are invited for a short, informal chat. You will see the outcome on your status page.":
      "يراجع أحد المنظمين كل طلب، وقد يُدعى بعض المتقدمين إلى محادثة قصيرة غير رسمية. ستظهر النتيجة في صفحة حالة طلبك.",
    "Create account & apply": "أنشئ حسابًا وقدّم",
    "I already have an account": "لدي حساب بالفعل",
    "A PSU email address is required for membership.":
      "يُشترط البريد الجامعي لجامعة الأمير سلطان للعضوية.",
    "STILL HAVE A QUESTION?": "ما زال لديك سؤال؟",
    "SEND IT TO THE COMMITTEE →": "← أرسله إلى اللجنة",

    /* --- Contact --- */
    CONTACT: "تواصل",
    INQUIRY: "استفسار",
    OPEN_CHANNEL: "قناة_مفتوحة",
    "Questions about membership, an event, a workshop, a competition, or working with the chapter — send them here. You do not need an account.":
      "أسئلتك عن العضوية أو فعالية أو ورشة أو مسابقة أو التعاون مع النادي — أرسلها من هنا. لا تحتاج إلى حساب.",
    ENUM_REQ: "اختيار_مطلوب",
    "Select a topic…": "اختر موضوعًا…",
    Subject: "الموضوع",
    Message: "الرسالة",
    TEXT_REQ: "نص_مطلوب",
    "Send message": "إرسال الرسالة",
    "What is this about?": "ما موضوع رسالتك؟",
    "Tell us what you would like to know.": "أخبرنا بما تودّ معرفته.",
    WHAT_TO_EXPECT: "ما_الذي_تتوقعه",
    "You get a": "تحصل على",
    "reference number": "رقم مرجعي",
    "straight away. Quote it if you follow up.": "فورًا. اذكره إن تابعت استفسارك.",
    "A committee member picks it up and replies by":
      "يتولّى أحد أعضاء اللجنة استفسارك ويردّ عبر",
    email: "البريد الإلكتروني",
    "Please allow a few days. The committee are": "يرجى الانتظار بضعة أيام، فأعضاء اللجنة",
    "students too": "طلاب أيضًا",
    FASTER_ROUTES: "طرق_أسرع",
    "Want to join? The": "تريد الانضمام؟",
    "membership page": "صفحة العضوية",
    "answers most questions.": "تجيب عن معظم الأسئلة.",
    "Looking for workshop material? Try the": "تبحث عن مواد الورش؟ جرّب",
    "digital archive": "الأرشيف الرقمي",
    "Already a member? Use the": "عضو بالفعل؟ استخدم",
    "member portal": "بوابة الأعضاء",
    DIRECT: "مباشر",
    "Prince Sultan University, Riyadh": "جامعة الأمير سلطان، الرياض",

    /* --- Open positions --- */
    "DIR: /PROJECTS/OPEN_ASSIGNMENTS": "المسار: /المشاريع/المهام_المتاحة",
    "Every opening shows the same information to every member: the work, the event it belongs to, capacity and closing date. Registration happens in the member portal, where a request is recorded against your account and reviewed by an organizer.":
      "تُعرض المعلومات نفسها لكل عضو في كل مهمة: العمل المطلوب، والفعالية التابعة لها، والسعة، وموعد الإغلاق. يتم التسجيل عبر بوابة الأعضاء، حيث يُسجَّل طلبك في حسابك ويراجعه أحد المنظمين.",
    "Members may request more than one role. Registration closes automatically at capacity, and every request is timestamped on your verified record.":
      "يمكن للأعضاء طلب أكثر من دور. يُغلق التسجيل تلقائيًا عند اكتمال العدد، ويُؤرَّخ كل طلب في سجلك الموثّق.",
    Event: "الفعالية",
    "Open to": "متاحة لـ",
    "All active members": "جميع الأعضاء النشطين",
    Closes: "تُغلق",
    Places: "المقاعد",
    "Sign in to register": "سجّل الدخول للتسجيل",
    "Register in the member portal": "سجّل عبر بوابة الأعضاء",
    "View in member portal": "اعرض في بوابة الأعضاء",
    "POSITION FILLED": "اكتمل العدد",
    "Open until filled": "مفتوحة حتى اكتمال العدد",
    "ACCESS:": "الوصول:",
    ALL_MEMBERS: "كل_الأعضاء",
    GENERAL: "عام",
    General: "عام",
    Tech: "التقني",
    Media: "الإعلام",
    "Tech Team Member": "عضو الفريق التقني",
    "Media Team Member": "عضو فريق الإعلام",
    "Workshop Team Member": "عضو فريق الورش",
    "Events Team Member": "عضو فريق الفعاليات",
    Member: "عضو",
    Volunteer: "متطوع",
    "Challenge Tester": "مختبِر التحديات",
    "CTF Floor Support": "دعم قاعة المسابقة",
    "Media & Documentation": "الإعلام والتوثيق",
    "Registration & Participant Support": "التسجيل ودعم المشاركين",
    "Technical Support": "الدعم التقني",
    "Event Operations": "تشغيل الفعالية",
    "Workshop Assistant": "مساعد الورشة",
    "Workshop Presenter": "مقدّم الورشة",
    "Test challenge instructions and participant flow before the event and report confusing steps or technical issues to organizers.":
      "اختبر تعليمات التحديات ومسار المشاركين قبل الفعالية، وأبلغ المنظمين عن أي خطوات مربكة أو مشكلات تقنية.",
    "Help teams with event logistics, rules questions, room flow, and escalation to technical organizers during the competition.":
      "ساعد الفرق في تنظيم الفعالية، والإجابة عن أسئلة القواعد، وتنظيم الحركة في القاعة، وتصعيد المشكلات إلى المنظمين التقنيين أثناء المسابقة.",
    "Capture approved event material, results, and documentation for the ACM/CyberTech archive and recap.":
      "وثّق المواد المعتمدة والنتائج والمستندات لأرشيف ACM/CyberTech وملخص الفعالية.",
    "Support check-in, participant questions, directions, and competition-day logistics.":
      "ادعم تسجيل الحضور، وأجب عن أسئلة المشاركين، ووجّههم، وساعد في تنظيم يوم المسابقة.",
    "Support competition setup, connectivity, participant access, and basic troubleshooting during the CTF.":
      "ادعم تجهيز المسابقة، والاتصال بالشبكة، ووصول المشاركين، وحل المشكلات الأساسية أثناء المسابقة.",

    /* --- Projects index --- */
    "DIR: /PROJECTS/ARCHIVE": "المسار: /المشاريع/الأرشيف",
    HACKATHON: "هاكاثون",
    "AI / HACKATHON": "ذكاء اصطناعي / هاكاثون",
    "Students, Alumni and COOP teams under one call, run in term 252 under the patronage of the Dean of CCIS. Four themes — education, healthcare, security and sustainability — screened on proposal, then judged across a poster round and a jury pitch, with more than SAR 9,000 in prizes.":
      "فرق من الطلاب والخريجين وطلاب التدريب التعاوني في دعوة واحدة، أُقيم في الفصل 252 برعاية عميد كلية علوم الحاسب والمعلومات. أربعة محاور — التعليم والصحة والأمن والاستدامة — تُفرز المقترحات أولًا، ثم تُحكَّم عبر جولة ملصقات وعرض أمام لجنة التحكيم، بجوائز تتجاوز 9,000 ريال.",
    "WebForge Workshop Programme": "برنامج ورش WebForge",
    "CTF 3.0 Workshops": "ورش CTF 3.0",

    /* --- Archive index --- */
    INDEX: "الفهرس",
    ALL_PROJECTS: "كل_المشاريع",
    "Everything the chapter has published, across every project and generation — workshop handouts, slide decks, competition reports, presentations, branding and source repositories. Each project also keeps its own archive page; this is the index across all of them.":
      "كل ما نشره النادي عبر مشاريعه ودفعاته — مطبوعات الورش، والعروض التقديمية، وتقارير المسابقات، والهوية البصرية، ومستودعات الشيفرة. لكل مشروع صفحة أرشيف خاصة به، وهذا فهرس يجمعها كلها.",
    "All projects": "كل المشاريع",
    "ACM PSU Digital Platform": "المنصة الرقمية لنادي ACM",
    "All categories": "كل الفئات",
    "Planning Document": "مستند تخطيط",
    Proposal: "مقترح",
    Rules: "القواعد",
    Registration: "التسجيل",
    Presentation: "عرض تقديمي",
    Poster: "ملصق",
    Photography: "التصوير",
    "Source Code": "الشيفرة المصدرية",
    Report: "تقرير",
    GRID: "شبكة",
    "Workshop Programme": "برنامج الورش",
    "Workshop Content": "محتوى الورش",
    "Day 1 — Planning & Development Workflow": "اليوم 1 — التخطيط ومسار التطوير",
    "Day 1 — Planning & Development Workflow — Handout": "اليوم 1 — التخطيط ومسار التطوير — مطبوعة",
    "Day 2 — Full-Stack Development & Debugging": "اليوم 2 — التطوير المتكامل وتصحيح الأخطاء",
    "Day 2 — Full-Stack Development & Debugging — Handout": "اليوم 2 — التطوير المتكامل وتصحيح الأخطاء — مطبوعة",
    "Day 3 — Deployment, Discovery & Optimization": "اليوم 3 — النشر والظهور في البحث وتحسين الأداء",
    "Day 3 — Deployment, Discovery & Optimization — Handout": "اليوم 3 — النشر والظهور في البحث وتحسين الأداء — مطبوعة",
    "AI Programming Jam Website": "موقع معسكر البرمجة بالذكاء الاصطناعي",
    LINK: "رابط",
    "Cheat Sheet": "ورقة مرجعية",
    "Participant Handout": "مطبوعة المشاركين",
    "Public Competition Report": "تقرير المسابقة العام",
    "Results Presentation": "عرض النتائج",
    "Slide Deck": "شرائح العرض",
    "Search the archive…": "ابحث في الأرشيف…",
    "Search the archive": "ابحث في الأرشيف",
    "Filter by project": "تصفية حسب المشروع",
    "Filter by category": "تصفية حسب الفئة",
    "Archive location": "موقع الأرشيف",

    /* --- CTF 2.0 archive --- */
    "DIR: /PROJECTS/CTFS/CTF-2.0": "المسار: /المشاريع/CTF/CTF-2.0",
    "STATUS: VERIFIED": "الحالة: موثّق",
    "CTF 2.0 Resource Archive": "أرشيف موارد CTF 2.0",
    "Competition results and the five-module Spring 2026 web-security workshop series created with CyberTech Club. Files are grouped by module, and private source records remain separate from public resources.":
      "نتائج المسابقة وسلسلة ورش أمن الويب ذات الوحدات الخمس لربيع 2026، المُعدّة مع نادي CyberTech. الملفات مجمّعة حسب الوحدة، وتبقى السجلات المصدرية الخاصة منفصلة عن الموارد العامة.",
    "CTF 3.0 Guide": "دليل CTF 3.0",
    "privacy-safe verified edition": "نسخة موثّقة تحفظ الخصوصية",
    "Module 01 Handout": "مطبوعة الوحدة 01",
    "recon & web proxies": "الاستطلاع ووسطاء الويب",
    "Access Control Cheat Sheet": "ورقة مرجعية للتحكم في الوصول",
    "module 02 quick reference": "مرجع سريع للوحدة 02",
    "Module 05 Handout": "مطبوعة الوحدة 05",
    "API exploitation & file attacks": "استغلال واجهات API وهجمات الملفات",
    "CTF 2.0 archive files": "ملفات أرشيف CTF 2.0",

    /* --- CTF 2.0 results --- */
    "2.0_RESULTS": "نتائج_2.0",
    "Final Results.": "النتائج النهائية.",
    "The verified close-of-competition standings from ACM/CyberTech CTF 2.0, the second edition of the Capture The Flag run by the ACM and CyberTech clubs at Prince Sultan University. Eleven teams worked through more than sixteen challenges spanning forensics, cryptography, OSINT and web categories, at difficulties from Very Easy to Insane. The numbers below are taken from the official competition report.":
      "الترتيب الموثّق عند ختام مسابقة ACM/CyberTech CTF 2.0، النسخة الثانية من مسابقة التقاط الأعلام التي ينظمها ناديا ACM وCyberTech في جامعة الأمير سلطان. عمل أحد عشر فريقًا على أكثر من ستة عشر تحديًا في التحليل الجنائي والتشفير والاستخبارات مفتوحة المصدر والويب، بمستويات صعوبة من السهل جدًا إلى الجنوني. الأرقام أدناه مأخوذة من تقرير المسابقة الرسمي.",
    "Competition Metrics": "مؤشرات المسابقة",
    "SOURCE: OFFICIAL REPORT // VERIFIED": "المصدر: التقرير الرسمي // موثّق",
    "Teams ranked": "الفرق المصنّفة",
    "Challenges released": "التحديات المطروحة",
    "Flag submissions": "محاولات إرسال الأعلام",
    "Successful captures": "الأعلام الملتقطة",
    "Failed attempts": "المحاولات الفاشلة",
    "Overall solve rate": "نسبة الحل الإجمالية",
    "Final Leaderboard": "لوحة الترتيب النهائية",
    "STATUS: FINAL // 11 ENTRIES": "الحالة: نهائي // 11 فريقًا",
    "Standings at the close of ACM/CyberTech CTF 2.0": "الترتيب عند ختام ACM/CyberTech CTF 2.0",
    Rank: "المركز",
    Score: "النقاط",
    "What the Numbers Showed": "ما كشفته الأرقام",
    "POST-COMPETITION ANALYSIS": "تحليل ما بعد المسابقة",
    "The spread was extreme": "تفاوت كبير في النتائج",
    "Two challenges were solved by every team that attempted them, and two were solved by nobody at all. A CTF that lands both ends of that range in one sitting is doing its job: there was an entry point for first-timers and a wall for the experienced.":
      "حلّ كل فريق حاول تحدّيين منها بالكامل، بينما لم يحلّ أحد تحدّيين آخرين إطلاقًا. المسابقة التي تجمع طرفَي هذا المدى في جلسة واحدة تؤدي مهمتها: مدخل للمبتدئين، وتحدٍّ صعب لأصحاب الخبرة.",
    "100% solved": "حُلّ بنسبة 100%",
    "0 solves": "0 حلول",
    "Most submissions missed": "أغلب المحاولات لم تُصب",
    "Of 852 flag submissions, 89 captured a flag and 763 did not — an overall solve rate of 10.4%. Failed attempts are not wasted work in a jeopardy CTF; they are the shape of teams narrowing down a guess. But the ratio is the clearest single argument for the preparation workshops that now run before each edition.":
      "من بين 852 محاولة، التقطت 89 علمًا ولم تنجح 763 — بنسبة حل إجمالية بلغت 10.4%. المحاولات الفاشلة ليست جهدًا ضائعًا في مسابقات Jeopardy؛ إنها طريقة الفرق في تضييق احتمالاتها. لكن هذه النسبة أوضح حجة لورش التحضير التي تُقام الآن قبل كل نسخة.",
    Captured: "ملتقطة",
    Failed: "فاشلة",
    "Solve rate": "نسبة الحل",
    "Points followed difficulty": "النقاط تتبع الصعوبة",
    "The challenge set ran from Very Easy to Insane across forensics, cryptography, OSINT, and general web and binary work. The Insane tier carried the single largest share of the point pool at 1,000 points, with the Hard tier and the insane-forensics challenges at 800 points each.":
      "تدرّجت التحديات من السهل جدًا إلى الجنوني في التحليل الجنائي والتشفير والاستخبارات مفتوحة المصدر والويب والملفات التنفيذية. حاز المستوى الجنوني أكبر حصة من النقاط بـ 1,000 نقطة، ونال المستوى الصعب وتحديات التحليل الجنائي الجنونية 800 نقطة لكلٍّ منهما.",
    "Insane tier": "المستوى الجنوني",
    "1,000 pts": "1,000 نقطة",
    "Hard tier": "المستوى الصعب",
    "Insane / forensics": "جنوني / تحليل جنائي",
    "Winning took breadth": "الفوز تطلّب تنوّعًا",
    "HZ finished on 3,800 points, a thousand clear of TheVault on 2,800 and 1,700 clear of ZERO DAY on 2,100. The published report confirms the final totals but does not include enough per-team solve data to attribute each team's score to particular categories.":
      "أنهى فريق HZ المسابقة بـ 3,800 نقطة، متقدمًا بألف نقطة على TheVault (2,800) وبـ 1,700 نقطة على ZERO DAY (2,100). يؤكد التقرير المنشور المجاميع النهائية، لكنه لا يتضمن بيانات حل كافية لكل فريق لنسبة نقاطه إلى فئات بعينها.",
    "3,800 pts": "3,800 نقطة",
    "2,800 pts": "2,800 نقطة",
    "2,100 pts": "2,100 نقطة",
    "Workshop content and event archive": "محتوى الورش وأرشيف الفعالية",
    "Browse the five-module Spring 2026 CyberTech Club workshop series, including participant handouts, quick-reference sheets, presentation slides, and the archived results deck.":
      "تصفّح سلسلة ورش نادي CyberTech ذات الوحدات الخمس لربيع 2026، بما فيها مطبوعات المشاركين، والأوراق المرجعية، وشرائح العرض، وعرض النتائج المؤرشف.",
    "Open the CTF 2.0 resource archive": "افتح أرشيف موارد CTF 2.0",
    "Source Documents": "المستندات المصدرية",
    "COMPETITION REPORT // PDF": "تقرير المسابقة // PDF",
    "PSU CTF Competition Report": "تقرير مسابقة CTF في جامعة الأمير سلطان",
    "A privacy-safe public edition of the report behind this page: competition overview, score distribution, submission percentages, per-challenge solve counts and rates, the category and difficulty breakdown, the point pool, and the final standings. Personal team-member contact details from the source file are intentionally omitted.":
      "نسخة عامة تحفظ الخصوصية من التقرير الذي تستند إليه هذه الصفحة: نظرة عامة على المسابقة، وتوزيع النقاط، ونسب الإرسال، وعدد الحلول ونسبها لكل تحدٍّ، والتوزيع حسب الفئة والصعوبة، ومجموع النقاط، والترتيب النهائي. حُذفت بيانات التواصل الشخصية لأعضاء الفرق عمدًا.",
    "Open the public report (PDF)": "افتح التقرير العام (PDF)",
    "Live scoreboard mirror": "نسخة مباشرة من لوحة النتائج",
    "The CTF event site carries the same verified standings alongside the registration and challenge information for the current edition.":
      "يعرض موقع المسابقة الترتيب الموثّق نفسه، إلى جانب معلومات التسجيل والتحديات للنسخة الحالية.",
    "Open the event scoreboard": "افتح لوحة نتائج المسابقة",
    "SYS.MSG: NEXT EDITION SCHEDULED": "رسالة_النظام: النسخة القادمة مجدولة",
    "CTF 3.0 Is Open.": "باب CTF 3.0 مفتوح.",
    "Saturday 24 October 2026, 10:00 to 13:00, Auditorium B105. Teams of two to three, three hours, four attack vectors. Registration is open now.":
      "السبت 24 أكتوبر 2026، من 10:00 حتى 13:00، قاعة B105. فرق من فردين إلى ثلاثة، ثلاث ساعات، أربعة مسارات. التسجيل مفتوح الآن.",
    "Register for CTF 3.0": "سجّل في CTF 3.0",
    "RESULTS:": "النتائج:",
    VERIFIED: "موثّقة",

    /* --- CTF 3.0 --- */
    "Capture The Flag": "التقاط الأعلام",
    "ACM/CyberTech CTF 3.0 is a jeopardy-style cybersecurity competition at Prince Sultan University. Teams investigate controlled challenges, recover hidden flags and submit them for points across four attack vectors: cryptography, web security, digital forensics and open-source intelligence.":
      "مسابقة ACM/CyberTech CTF 3.0 مسابقة أمن سيبراني بنظام Jeopardy في جامعة الأمير سلطان. تحقّق الفرق في تحديات مُعدّة مسبقًا، وتستخرج الأعلام المخفية وترسلها لتحصد النقاط في أربعة مسارات: التشفير، وأمن الويب، والتحليل الجنائي الرقمي، والاستخبارات مفتوحة المصدر.",
    "Register on Event Site": "سجّل عبر موقع الفعالية",
    "Read Official Rules": "اقرأ القواعد الرسمية",
    "Mission Parameters": "تفاصيل المهمة",
    "SATURDAY // RIYADH": "السبت // الرياض",
    "Competition date": "تاريخ المسابقة",
    "Time (UTC+3)": "الوقت (UTC+3)",
    "Continuous play": "لعب متواصل",
    "Members per team": "عدد أعضاء الفريق",
    "Auditorium, 2nd floor": "القاعة، الطابق الثاني",
    "Attack Vectors": "مسارات الهجوم",
    "04 CATEGORIES // FLAGS CLASSIFIED": "04 فئات // الأعلام سرّية",
    Cryptography: "التشفير",
    "Recognize patterns, decode information, analyze historical and modern encryption methods, and recover hidden messages.":
      "تعرّف على الأنماط، وفكّ ترميز المعلومات، وحلّل أساليب التشفير القديمة والحديثة، واستخرج الرسائل المخفية.",
    Skills: "المهارات",
    "Ciphers, encoding, hashing": "الشيفرات، الترميز، التجزئة",
    "Web Security": "أمن الويب",
    "Inspect how applications behave, identify insecure code or configuration, and find a route to protected information.":
      "افحص سلوك التطبيقات، وحدّد الشيفرة أو الإعدادات غير الآمنة، وجد طريقًا إلى المعلومات المحمية.",
    "HTTP, source analysis, vulnerabilities": "HTTP، تحليل الشيفرة، الثغرات",
    "Digital Forensics": "التحليل الجنائي الرقمي",
    "Follow evidence across files, metadata, logs, network data and other artifacts to reconstruct what happened.":
      "تتبّع الأدلة عبر الملفات والبيانات الوصفية والسجلات وبيانات الشبكة وغيرها لإعادة بناء ما حدث.",
    "File analysis, metadata, logs": "تحليل الملفات، البيانات الوصفية، السجلات",
    OSINT: "الاستخبارات مفتوحة المصدر",
    "Search public sources effectively, correlate clues and identify the intelligence needed to reach the flag.":
      "ابحث في المصادر العامة بفاعلية، واربط الأدلة ببعضها، وحدّد المعلومات اللازمة للوصول إلى العلم.",
    "Search, reconnaissance, correlation": "البحث، الاستطلاع، الربط",
    "Workshops before competition": "ورش قبل المسابقة",
    "Competition Protocol": "خطوات المسابقة",
    "ACCESS → INVESTIGATE → CAPTURE → SCORE": "الوصول ← التحقيق ← الالتقاط ← النقاط",
    "FORM A TEAM": "كوّن فريقًا",
    "REGISTER 2–3 MEMBERS; SOLO ENTRY IS NOT ALLOWED": "سجّل 2–3 أعضاء؛ لا يُسمح بالمشاركة الفردية",
    REGISTER: "التسجيل",
    "ACCESS THE RANGE": "ادخل بيئة المسابقة",
    "CONNECT TO THE COMPETITION PLATFORM USING ON-SITE NETWORK ACCESS": "اتصل بمنصة المسابقة عبر شبكة الموقع",
    CONNECT: "الاتصال",
    "SOLVE & CAPTURE": "حلّ والتقط",
    "INVESTIGATE PROVIDED TARGETS AND SUBMIT FLAGS AS ACM{...}": "حقّق في الأهداف المتاحة وأرسل الأعلام بصيغة ACM{...}",
    COMPETE: "المنافسة",
    "CLIMB THE SCOREBOARD": "تقدّم في لوحة النتائج",
    "VALID FLAGS ADD POINTS; HIGHEST FINAL SCORES RANK FIRST": "الأعلام الصحيحة تضيف نقاطًا؛ الأعلى نقاطًا يتصدّر",
    SCORE: "النقاط",
    "Workshops & Readiness": "الورش والاستعداد",
    "Preparation workshops": "ورش التحضير",
    "Public workshops are scheduled by category before the competition: web and cryptography on 21 October; forensics and OSINT on 22 October. Session times, locations, instructors and detailed prerequisites have not yet been announced.":
      "تُعقد ورش عامة حسب الفئة قبل المسابقة: الويب والتشفير في 21 أكتوبر، والتحليل الجنائي والاستخبارات مفتوحة المصدر في 22 أكتوبر. لم تُعلن بعد أوقات الجلسات وأماكنها ومقدّموها والمتطلبات التفصيلية.",
    "Check workshop updates": "تابع تحديثات الورش",
    "What to bring": "ما الذي تحضره",
    "Every participant must bring a personal laptop and charger. Organizers provide network access on site. Any workshop-specific software or virtual-machine requirements will be announced with the workshop details.":
      "على كل مشارك إحضار حاسوبه المحمول وشاحنه. يوفّر المنظمون الاتصال بالشبكة في الموقع، وستُعلن أي برامج أو أجهزة افتراضية تتطلبها الورش مع تفاصيلها.",
    Laptop: "حاسوب محمول",
    Charger: "شاحن",
    "Network access": "الاتصال بالشبكة",
    "Provided on site": "متوفّر في الموقع",
    "Scope and safety": "النطاق والسلامة",
    "Participants may interact only with systems, files and targets explicitly provided for the competition. Unauthorized scanning, attacks on out-of-scope infrastructure, interference with other teams or credential misuse can result in disqualification.":
      "يقتصر تعامل المشاركين على الأنظمة والملفات والأهداف المخصّصة للمسابقة صراحةً. قد يؤدي الفحص غير المصرّح به، أو مهاجمة بنية خارج النطاق، أو التدخل في عمل الفرق الأخرى، أو إساءة استخدام بيانات الدخول إلى الاستبعاد.",
    "Difficulty and scoring": "الصعوبة والنقاط",
    "Challenges range from Very Easy to Insane. Point values may vary and can be assigned dynamically based on solve rates; the exact challenge database remains classified until competition day.":
      "تتدرّج التحديات من السهل جدًا إلى الجنوني. قد تتفاوت قيم النقاط وتُحدَّد ديناميكيًا حسب نسب الحل، وتبقى قائمة التحديات سرّية حتى يوم المسابقة.",
    "Difficulty range": "مدى الصعوبة",
    "Very Easy → Insane": "سهل جدًا ← جنوني",
    Scoreboard: "لوحة النتائج",
    "Activates competition day": "تُفعَّل يوم المسابقة",
    "Previous Edition": "النسخة السابقة",
    "CTF 2.0 // VERIFIED ARCHIVE": "CTF 2.0 // أرشيف موثّق",
    Challenges: "التحديات",
    "Winner, 3,800 points": "الفائز، 3,800 نقطة",
    "Explore the CTF 2.0 results and report": "استكشف نتائج CTF 2.0 وتقريرها",
    "Browse the CTF 2.0 workshop archive": "تصفّح أرشيف ورش CTF 2.0",
    "REGISTRATION STATUS: OPEN": "حالة التسجيل: مفتوح",
    "Enter the Cyber Range.": "ادخل ساحة المنافسة.",
    "Form your team, review the official rules and arrive with your laptop ready.":
      "كوّن فريقك، وراجع القواعد الرسمية، واحضر وحاسوبك جاهز.",
    "Open CTF 3.0 Event Site": "افتح موقع CTF 3.0",
    "EVENT:": "الفعالية:",
    SCHEDULED: "مجدولة",

    /* --- CTF 3.0 workshops --- */
    "DIR: /PROJECTS/CTF-3.0/WORKSHOPS": "المسار: /المشاريع/CTF-3.0/الورش",
    "STATUS: AWAITING CONTENT": "الحالة: بانتظار المحتوى",
    "0 FILES": "0 ملفات",
    "0 DIRECTORIES": "0 مجلدات",
    "Resource archive for the CTF 3.0 preparation workshops. Only verified, CTF-specific learning material will be published here.":
      "أرشيف موارد ورش التحضير لـ CTF 3.0. لن يُنشر هنا إلا المحتوى التعليمي الموثّق والخاص بالمسابقة.",
    "DIRECTORY_STATUS: EMPTY": "حالة_المجلد: فارغ",
    "No resources published yet.": "لم تُنشر أي موارد بعد.",
    "Workshop files will appear here after CTF-specific material is finalized and verified.":
      "ستظهر ملفات الورش هنا بعد اعتماد المحتوى الخاص بالمسابقة وتوثيقه.",

    /* --- PSU AI Hackathon 2.0 --- */
    "Hackathon 2.0.": "هاكاثون 2.0.",
    "Students & Alumni United. Run in term 252 under the patronage of the Dean of CCIS, Dr. Mohammed Ali Alshara, this edition opened the ACM Student Chapter's AI hackathon to Alumni and COOP students alongside current students. Teams built against one of four themes — AI in education, healthcare, security and sustainability — and advanced through proposal screening, a poster round and a jury pitch.":
      "الطلاب والخريجون معًا. أُقيمت هذه النسخة في الفصل 252 برعاية عميد كلية علوم الحاسب والمعلومات، د. محمد علي الشرعة، وفتحت هاكاثون الذكاء الاصطناعي لنادي ACM الطلابي أمام الخريجين وطلاب التدريب التعاوني إلى جانب الطلاب الحاليين. عملت الفرق على أحد أربعة محاور — الذكاء الاصطناعي في التعليم والصحة والأمن والاستدامة — وتأهّلت عبر فرز المقترحات، ثم جولة الملصقات، ثم العرض أمام لجنة التحكيم.",
    "Contact on WhatsApp": "تواصل عبر واتساب",
    "Event Parameters": "تفاصيل الفعالية",
    "TERM 252 // RIYADH": "الفصل 252 // الرياض",
    "Call opens": "فتح باب المشاركة",
    "Submission deadline": "آخر موعد للتقديم",
    "Competition & pitch": "المسابقة والعرض",
    "Members per team (max)": "أعضاء الفريق (الحد الأقصى)",
    "Building, PSU Riyadh": "مبنى، جامعة الأمير سلطان بالرياض",
    "The Four Themes": "المحاور الأربعة",
    "SDGs // VISION 2030": "أهداف التنمية المستدامة // رؤية 2030",
    "AI in Education": "الذكاء الاصطناعي في التعليم",
    "Transform learning experiences, personalise education, widen accessibility and give students and educators intelligent tools to work with.":
      "طوّر تجارب التعلّم، وخصّص التعليم، ووسّع إمكانية الوصول، وقدّم للطلاب والمعلمين أدوات ذكية.",
    Focus: "التركيز",
    "EdTech, learning, accessibility": "تقنيات التعليم، التعلّم، إمكانية الوصول",
    "AI in Healthcare": "الذكاء الاصطناعي في الرعاية الصحية",
    "Improve patient care and diagnostics, accelerate discovery, and make healthcare more efficient, accurate and reachable.":
      "حسّن رعاية المرضى والتشخيص، وسرّع الاكتشاف، واجعل الرعاية الصحية أكثر كفاءة ودقة وإتاحة.",
    "MedTech, diagnostics, wellness": "التقنيات الطبية، التشخيص، العافية",
    "AI for Security": "الذكاء الاصطناعي للأمن",
    "Strengthen cybersecurity, detect threats in real time, prevent fraud, and protect critical infrastructure and digital identities.":
      "عزّز الأمن السيبراني، واكتشف التهديدات لحظيًا، وامنع الاحتيال، واحمِ البنى التحتية الحيوية والهويات الرقمية.",
    "CyberSec, fraud detection, defence": "الأمن السيبراني، كشف الاحتيال، الدفاع",
    "AI for Sustainability": "الذكاء الاصطناعي للاستدامة",
    "Apply AI to environmental stewardship, efficient resource use, smarter cities and long-term resilience.":
      "وظّف الذكاء الاصطناعي في حماية البيئة، وترشيد الموارد، والمدن الذكية، والمرونة طويلة الأمد.",
    "ESG, climate, smart cities": "الحوكمة البيئية، المناخ، المدن الذكية",
    "TEAMS MAY PICK ONE OR MORE THEMES. A WORKING FINAL YEAR PROJECT MAY BE SUBMITTED IF IT FITS.":
      "يمكن للفرق اختيار محور أو أكثر. ويمكن تقديم مشروع تخرّج عامل إن كان مناسبًا.",
    "Competition Format": "صيغة المسابقة",
    "SCREEN → POSTER → PITCH → AWARD": "الفرز ← الملصق ← العرض ← الجوائز",
    "INITIAL SCREENING": "الفرز الأولي",
    "PROPOSALS REVIEWED BY ACM PROFESSIONAL CHAPTER CORE MEMBERS": "يراجع المقترحاتِ أعضاءُ الفرع المهني لـ ACM",
    SUBMIT: "التقديم",
    "POSTER COMPETITION": "مسابقة الملصقات",
    "SELECTED TEAMS PRESENT ON FREESTANDING POSTERS; COMMITTEE MEMBERS VISIT EACH ONE": "تعرض الفرق المختارة ملصقاتها، ويزور أعضاء اللجنة كل ملصق",
    PRESENT: "العرض",
    "SHORTLISTED PRESENTATIONS": "عروض المتأهلين",
    "TOP TEAMS PITCH TO THE JURY IN UP TO FIVE MINUTES": "تعرض أفضل الفرق أمام لجنة التحكيم في خمس دقائق كحد أقصى",
    PITCH: "العرض الختامي",
    "WINNERS ANNOUNCEMENT": "إعلان الفائزين",
    "AWARD CEREMONY WITH THE DEAN'S PARTICIPATION": "حفل تكريم بمشاركة العميد",
    AWARD: "الجوائز",
    "SHORTLISTING HAPPENS AT THE END OF EVERY STAGE; ONLY FINAL SHORTLISTED TEAMS COMPETE ON SITE.":
      "يُجرى التأهيل في نهاية كل مرحلة؛ ولا يتنافس حضوريًا إلا المتأهلون النهائيون.",
    "Who Can Join": "من يمكنه المشاركة",
    "STUDENTS × ALUMNI × COOP": "الطلاب × الخريجون × التدريب التعاوني",
    "Team composition": "تكوين الفريق",
    "Every team is led by a current PSU student and must include at least one Alumni or COOP member. Alumni and COOP participants are encouraged to join student-led teams rather than compete separately.":
      "يقود كل فريق طالب حالي في جامعة الأمير سلطان، ويجب أن يضم خريجًا أو متدربًا تعاونيًا واحدًا على الأقل. يُشجَّع الخريجون والمتدربون على الانضمام إلى فرق يقودها طلاب بدلًا من المنافسة منفصلين.",
    "Team size": "حجم الفريق",
    "Maximum 5 members": "5 أعضاء كحد أقصى",
    "Team leader": "قائد الفريق",
    "Current PSU student": "طالب حالي في الجامعة",
    "At least one Alumni or COOP member": "خريج أو متدرب تعاوني واحد على الأقل",
    "Eligible submissions": "المشاركات المؤهلة",
    "Projects must fit one or more of the four hackathon themes. A working final year project is eligible if it aligns with a theme and meets the competition requirements.":
      "يجب أن تناسب المشاريع محورًا أو أكثر من محاور الهاكاثون الأربعة. ويُقبل مشروع التخرّج العامل إن توافق مع أحد المحاور واستوفى متطلبات المسابقة.",
    "Built on 2025": "امتداد لنسخة 2025",
    "ACM PSU AI Hackathon 2025 drew 19 teams and produced award-winning work in healthcare, education, assistive technology and smart cities. Edition 2.0 widens that base by bringing Alumni and COOP students into the same call.":
      "استقطب هاكاثون ACM للذكاء الاصطناعي 2025 تسعة عشر فريقًا، وأثمر أعمالًا فائزة في الصحة والتعليم والتقنيات المساعدة والمدن الذكية. وتوسّع النسخة 2.0 هذه القاعدة بضم الخريجين وطلاب التدريب التعاوني إلى الدعوة نفسها.",
    "The final competition and pitch ran on 2 May 2026 at 11:00 in Building 105, Prince Sultan University. Light snacks, tea and water were provided on site.":
      "أُقيمت المسابقة النهائية والعروض في 2 مايو 2026 الساعة 11:00 في المبنى 105 بجامعة الأمير سلطان، مع تقديم وجبات خفيفة وشاي وماء في الموقع.",
    "Judging Rubric": "معايير التحكيم",
    "07 CRITERIA // TOTAL 100%": "07 معايير // المجموع 100%",
    "Scoring weights, adapted from ACM PSU AI Hackathon 2025": "أوزان التقييم، مقتبسة من هاكاثون ACM للذكاء الاصطناعي 2025",
    Criterion: "المعيار",
    "Technical execution — AI model effectiveness and implementation": "التنفيذ التقني — فاعلية نموذج الذكاء الاصطناعي وتطبيقه",
    "Innovation and creativity — uniqueness of the solution": "الابتكار والإبداع — تفرّد الحل",
    "Feasibility and scalability — real-world applicability": "الجدوى وقابلية التوسّع — إمكانية التطبيق الواقعي",
    "Business viability — market potential": "الجدوى التجارية — فرص السوق",
    "Presentation and storytelling — clarity and engagement": "العرض والسرد — الوضوح والتفاعل",
    "Ethical integrity — adherence to AI ethics": "النزاهة الأخلاقية — الالتزام بأخلاقيات الذكاء الاصطناعي",
    "Interdisciplinary collaboration — team diversity": "التعاون متعدد التخصصات — تنوّع الفريق",
    "Prizes & Recognition": "الجوائز والتكريم",
    "SAR 9,000+ TOTAL": "أكثر من 9,000 ريال إجمالًا",
    "1st place, SAR": "المركز الأول، ريال",
    "2nd place, SAR": "المركز الثاني، ريال",
    "3rd place, SAR": "المركز الثالث، ريال",
    "Poster category": "فئة الملصقات",
    DEAN: "العميد",
    "Choice & support awards": "جوائز الاختيار والدعم",
    "Award categories": "فئات الجوائز",
    "Cash prizes go to the top three presentations; the poster category is ranked separately. The Dean's Choice Award recognises the best overall presentation, and Dean's Special Support Awards back selected innovative projects.":
      "تُمنح الجوائز النقدية لأفضل ثلاثة عروض، وتُرتَّب فئة الملصقات منفصلة. تكرّم جائزة اختيار العميد أفضل عرض إجمالًا، وتدعم جوائز العميد الخاصة مشاريع مبتكرة مختارة.",
    "Beyond the prize money": "ما بعد الجوائز المالية",
    "Selected ideas may receive mentorship and incubation opportunities, and winning teams may be considered for research collaborations, internships and startup incubation.":
      "قد تحظى أفكار مختارة بالإرشاد وفرص الاحتضان، وقد تُرشَّح الفرق الفائزة لتعاونات بحثية وتدريب عملي واحتضان للشركات الناشئة.",
    Organisers: "المنظمون",
    "PATRONAGE: DEAN OF CCIS": "الرعاية: عميد كلية علوم الحاسب والمعلومات",
    "Under the Dean's patronage": "برعاية العميد",
    "The hackathon ran under the patronage of the Dean of CCIS, Dr. Mohammed Ali Alshara, with the Dean taking part in the closing award ceremony.":
      "أُقيم الهاكاثون برعاية عميد كلية علوم الحاسب والمعلومات، د. محمد علي الشرعة، الذي شارك في حفل التكريم الختامي.",
    "Hosting bodies": "الجهات المستضيفة",
    "Delivered by the ACM Student Chapter at Prince Sultan University with the ACM Professional Chapter in Saudi Arabia, under the College of Computer and Information Sciences.":
      "نظّمه نادي ACM الطلابي في جامعة الأمير سلطان مع الفرع المهني لـ ACM في المملكة العربية السعودية، تحت مظلة كلية علوم الحاسب والمعلومات.",
    Host: "المستضيف",
    "ACM Student Chapter, PSU": "نادي ACM الطلابي، جامعة الأمير سلطان",
    Screening: "الفرز",
    "ACM Professional Chapter core members": "أعضاء الفرع المهني لـ ACM",
    "CCIS, Prince Sultan University": "كلية علوم الحاسب والمعلومات، جامعة الأمير سلطان",
    "SUBMISSIONS CLOSED 25 APRIL 2026 · 11:59 PM": "أُغلق التقديم 25 أبريل 2026 · 11:59 مساءً",
    "The Full Event Site.": "موقع الفعالية الكامل.",
    "The original hackathon site is kept as part of the event record, including the announcement, the organiser logos and the registration form.":
      "يُحفظ موقع الهاكاثون الأصلي ضمن سجل الفعالية، بما فيه الإعلان وشعارات المنظمين ونموذج التسجيل.",
    "Open PSU AI Hackathon 2.0 Event Site": "افتح موقع هاكاثون PSU للذكاء الاصطناعي 2.0",
    CONCLUDED: "انتهت",

    /* --- WebForge (JAM.26) archive --- */
    "DIR: /PROJECTS/WEB-DEVELOPMENT/WEBFORGE-2026": "المسار: /المشاريع/تطوير-الويب/WEBFORGE-2026",
    "STATUS: ACTIVE": "الحالة: نشط",
    "The working library behind JAM.26: participant lessons and checklists, instructor planning records, reusable project templates, and event media. Version folders preserve older files without overwriting them.":
      "المكتبة العملية خلف JAM.26: دروس المشاركين وقوائم التحقق، وسجلات تخطيط المدربين، وقوالب مشاريع قابلة لإعادة الاستخدام، ووسائط الفعالية. تحفظ مجلدات الإصدارات الملفات القديمة دون الكتابة فوقها.",
    Documents: "المستندات",
    "Day 1 Lesson": "درس اليوم 1",
    "Day 2 Handout": "مطبوعة اليوم 2",
    "full-stack checklist · PDF": "قائمة تحقق التطوير المتكامل · PDF",
    "JAM.26 Event Banner": "لافتة فعالية JAM.26",
    Handouts: "المطبوعات",
    Planning: "التخطيط",
    Templates: "القوالب",
    External: "روابط خارجية",

    /* --- WebForge (JAM.26) event page --- */
    "ACM Programming": "ACM للبرمجة",
    "An AI-assisted web engineering competition. Every team receives the same application brief on competition day, then plans it, designs it, builds it, deploys it and presents it — and adapts when the requirements change mid-competition. Three preparation workshop days run first, walking through the exact workflow the competition tests.":
      "مسابقة في هندسة الويب بمساعدة الذكاء الاصطناعي. يستلم كل فريق الوصف نفسه للتطبيق يوم المسابقة، ثم يخطّط له ويصمّمه ويبنيه وينشره ويعرضه — ويتكيّف حين تتغيّر المتطلبات أثناء المسابقة. تسبقها ثلاثة أيام من ورش التحضير تمرّ على مسار العمل نفسه الذي تختبره المسابقة.",
    "Open the Event Site": "افتح موقع الفعالية",
    "Browse the Archive": "تصفّح الأرشيف",
    "Key Dates": "المواعيد الرئيسية",
    "SEASON 2026 // VENUE TBD": "موسم 2026 // المكان يُحدَّد لاحقًا",
    "Workshop day 01": "يوم الورشة 01",
    "Workshop day 02": "يوم الورشة 02",
    "Workshop day 03": "يوم الورشة 03",
    "Competition day": "يوم المسابقة",
    "One Brief. Four Phases.": "وصف واحد. أربع مراحل.",
    "PLAN → BUILD → SHIP → ADAPT": "خطّط ← ابنِ ← انشر ← تكيّف",
    PHASE: "المرحلة",
    "UNDERSTAND & PLAN": "افهم وخطّط",
    DATE: "التاريخ",
    WORK: "العمل",
    "READ REQUIREMENTS, MAP THE SYSTEM IN EXCALIDRAW, DESIGN THE UI IN VARIANT":
      "اقرأ المتطلبات، وارسم النظام في Excalidraw، وصمّم الواجهة في Variant",
    "BUILD & CONNECT": "ابنِ واربط",
    "DEVELOP IN VS CODE WITH AI ASSISTANTS, ADD FIREBASE AUTH AND PERSISTENT DATA, DEBUG SYSTEMATICALLY":
      "طوّر في VS Code بمساعدة الذكاء الاصطناعي، وأضف مصادقة Firebase وبيانات دائمة، وصحّح الأخطاء بمنهجية",
    "DEPLOY & MEASURE": "انشر وقِس",
    "VERSION WITH GITHUB, DEPLOY TO VERCEL, POINT A DOMAIN VIA CLOUDFLARE, MEASURE WITH PAGESPEED INSIGHTS":
      "أدِر الإصدارات عبر GitHub، وانشر على Vercel، واربط نطاقًا عبر Cloudflare، وقِس الأداء بـ PageSpeed Insights",
    "ADAPT & PRESENT": "تكيّف واعرض",
    "RESPOND TO THE UNEXPECTED CHANGE REQUEST, THEN DEMONSTRATE AND EXPLAIN WHAT YOU BUILT":
      "استجب لطلب التغيير المفاجئ، ثم اعرض ما بنيته واشرحه",
    "Scoring Rubric": "معايير التقييم",
    "100 POINTS // 07 CATEGORIES": "100 نقطة // 07 فئات",
    "How JAM.26 projects are judged": "كيف تُحكَّم مشاريع JAM.26",
    "What is assessed": "ما الذي يُقيَّم",
    "Functional Completeness": "اكتمال الوظائف",
    "Does the application meet the provided requirements and function correctly?":
      "هل يستوفي التطبيق المتطلبات المحددة ويعمل بشكل صحيح؟",
    "Technical Implementation": "التنفيذ التقني",
    "How effectively were authentication, persistent data, application logic, GitHub and deployment implemented?":
      "ما مدى فاعلية تنفيذ المصادقة والبيانات الدائمة ومنطق التطبيق وGitHub والنشر؟",
    "Problem Solving & Adaptability": "حل المشكلات والتكيّف",
    "How effectively did the team debug problems and respond to the unexpected requirement change?":
      "ما مدى فاعلية الفريق في تصحيح المشكلات والاستجابة لتغيّر المتطلبات المفاجئ؟",
    "UI/UX & Design": "الواجهة وتجربة المستخدم والتصميم",
    "Is the application intuitive, coherent, responsive and easy to use?":
      "هل التطبيق بديهي ومتّسق ومتجاوب وسهل الاستخدام؟",
    "System Understanding & Planning": "فهم النظام والتخطيط",
    "Can the team explain its Excalidraw diagram and how the major parts of the system interact?":
      "هل يستطيع الفريق شرح مخطط Excalidraw وكيف تتفاعل الأجزاء الرئيسية للنظام؟",
    "Production Readiness & Performance": "الجاهزية للإنتاج والأداء",
    "Deployed correctly, connected to a domain, prepared for search discovery, and evaluated with PageSpeed Insights.":
      "منشور بشكل صحيح، ومرتبط بنطاق، ومهيّأ للظهور في محركات البحث، ومُقيَّم بـ PageSpeed Insights.",
    "Final Demonstration": "العرض النهائي",
    "Can the team clearly demonstrate and explain its solution?": "هل يستطيع الفريق عرض حلّه وشرحه بوضوح؟",
    "Rules & Toolchain": "القواعد والأدوات",
    "11 PROHIBITIONS // AI ENCOURAGED": "11 محظورًا // الذكاء الاصطناعي مُشجَّع",
    "AI is part of the jam": "الذكاء الاصطناعي جزء من المسابقة",
    "AI may generate part or all of your application. There is no requirement to write a specific amount of code by hand. What the rules protect is fairness, not manual effort — so the AI tier limit is the one hard line: free and standard paid consumer plans are allowed, highest-tier and advanced premium access is not. ChatGPT Plus qualifies; ChatGPT Pro does not, and the same principle applies to every other provider.":
      "يمكن للذكاء الاصطناعي أن يولّد جزءًا من تطبيقك أو كله، ولا يُشترط كتابة قدر معيّن من الشيفرة يدويًا. ما تحميه القواعد هو العدالة لا الجهد اليدوي — لذا فحدّ فئة الاشتراك هو الخط الوحيد الصارم: الخطط المجانية والمدفوعة العادية مسموحة، والفئات العليا والمتقدمة غير مسموحة. ChatGPT Plus مقبول وChatGPT Pro غير مقبول، والمبدأ نفسه ينطبق على كل مزوّد آخر.",
    "AI-generated code": "شيفرة مولّدة بالذكاء الاصطناعي",
    Allowed: "مسموح",
    "Full AI build": "بناء كامل بالذكاء الاصطناعي",
    "Manual code minimum": "حد أدنى للشيفرة اليدوية",
    None: "لا يوجد",
    "Highest-tier AI plans": "خطط الذكاء الاصطناعي العليا",
    Prohibited: "محظور",
    "Human help stops at your team": "المساعدة البشرية تقتصر على فريقك",
    "Coding, debugging, design, architecture and problem-solving help may come from AI or from your own registered teammates — nobody else. Competing teams may not exchange code, prompts, solutions, implementation details or strategies. Public libraries, frameworks and documentation are normal development resources and are never counted as outside help.":
      "المساعدة في البرمجة وتصحيح الأخطاء والتصميم والبنية وحل المشكلات تأتي من الذكاء الاصطناعي أو من زملائك المسجّلين في فريقك فقط. لا يجوز للفرق المتنافسة تبادل الشيفرة أو الأوامر أو الحلول أو تفاصيل التنفيذ أو الاستراتيجيات. المكتبات والأطر والتوثيق العامة موارد تطوير عادية ولا تُعدّ مساعدة خارجية.",
    "The brief opens the clock": "الوصف يبدأ العدّ",
    "No team may start building a solution for the competition challenge before it is officially released, and no pre-built or copied application may be submitted as the team's work. A requirement change arrives mid-competition and must be satisfied — ignoring it is a rule breach, not a design choice. The version standing at the deadline is the version that gets judged.":
      "لا يجوز لأي فريق البدء في بناء حل لتحدي المسابقة قبل إطلاقه رسميًا، ولا تقديم تطبيق مُعدّ مسبقًا أو منسوخ على أنه عمل الفريق. يصل تغيير في المتطلبات أثناء المسابقة ويجب تلبيته — وتجاهله مخالفة للقواعد لا خيار تصميمي. النسخة القائمة عند الموعد النهائي هي التي تُحكَّم.",
    Toolchain: "الأدوات",
    "The workshops and the competition run on one deliberate stack, so nobody spends competition day fighting an unfamiliar tool.":
      "تعتمد الورش والمسابقة على مجموعة أدوات واحدة مختارة، حتى لا يقضي أحد يوم المسابقة في مواجهة أداة غير مألوفة.",
    Plan: "التخطيط",
    Build: "البناء",
    "Data & auth": "البيانات والمصادقة",
    Ship: "النشر",
    Measure: "القياس",
    "Read all 11 rules": "اقرأ القواعد الـ 11 كاملة",
    "Submission Checklist": "قائمة التسليم",
    "DUE AT THE DEADLINE // MUST BE LIVE DURING JUDGING": "تُسلَّم عند الموعد النهائي // ويجب أن تعمل أثناء التحكيم",
    "The application": "التطبيق",
    "Live production website": "موقع منشور يعمل",
    "Custom domain or subdomain": "نطاق مخصّص أو فرعي",
    "GitHub repository": "مستودع GitHub",
    "Firebase authentication": "مصادقة Firebase",
    Working: "يعمل",
    "Persistent data": "بيانات دائمة",
    "Required app features": "ميزات التطبيق المطلوبة",
    Complete: "مكتملة",
    "The evidence": "الأدلة",
    "Excalidraw functional diagram": "مخطط Excalidraw الوظيفي",
    "Unexpected change request": "طلب التغيير المفاجئ",
    Completed: "مُنجز",
    Recorded: "مُسجَّلة",
    "PageSpeed Insights result": "نتيجة PageSpeed Insights",
    "Preparation Workshops": "ورش التحضير",
    "DEVELOPED AND TAUGHT BY SHOUG ALOMRAN": "إعداد وتقديم: شوق العمران",
    "Day 01 — Planning & Development Workflow": "اليوم 01 — التخطيط ومسار التطوير",
    "Turning a problem into a structured development plan before writing code: understanding requirements and constraints, breaking a project into features, planning the application structure, splitting frontend and backend responsibilities, and using AI strategically at the planning stage.":
      "تحويل المشكلة إلى خطة تطوير منظّمة قبل كتابة الشيفرة: فهم المتطلبات والقيود، وتقسيم المشروع إلى ميزات، وتخطيط بنية التطبيق، وتوزيع المسؤوليات بين الواجهة الأمامية والخلفية، وتوظيف الذكاء الاصطناعي بذكاء في مرحلة التخطيط.",
    "Explore Day 01": "استكشف اليوم 01",
    "Day 02 — Full-Stack Development & Debugging": "اليوم 02 — التطوير المتكامل وتصحيح الأخطاء",
    "Turning the plan into a working application and learning to diagnose problems when it breaks: connecting frontend and backend logic, working with application state and data, implementing and consuming APIs, reading errors, and using AI to investigate rather than blindly rewrite.":
      "تحويل الخطة إلى تطبيق يعمل، وتعلّم تشخيص المشكلات حين يتعطّل: ربط منطق الواجهة الأمامية بالخلفية، والتعامل مع حالة التطبيق وبياناته، وبناء واجهات API واستهلاكها، وقراءة الأخطاء، واستخدام الذكاء الاصطناعي للتحقيق بدل إعادة الكتابة العمياء.",
    "Explore Day 02": "استكشف اليوم 02",
    "Day 03 — Deployment, Domains & Production Readiness": "اليوم 03 — النشر والنطاقات والجاهزية للإنتاج",
    "The final stage: take the application from localhost to a real production URL, point a domain at it through Cloudflare, submit it to search engines, and measure it with PageSpeed Insights. Deploy, domain, index, measure.":
      "المرحلة الأخيرة: نقل التطبيق من الجهاز المحلي إلى رابط إنتاج حقيقي، وربط نطاق به عبر Cloudflare، وإرساله إلى محركات البحث، وقياسه بـ PageSpeed Insights. انشر، اربط، أرشف، قِس.",
    "Explore Day 03": "استكشف اليوم 03",
    "Do you need experience?": "هل تحتاج إلى خبرة؟",
    "No. The jam is built for participants who are still learning — the workshops introduce the whole workflow first. What the competition asks is that your team can investigate a problem, direct its tools at a solution, test the result, and verify the application actually works. You do not need a team before registering; the team formation page will place you in one.":
      "لا. صُمّمت المسابقة لمن لا يزالون يتعلّمون — فالورش تقدّم مسار العمل كاملًا أولًا. كل ما تطلبه المسابقة أن يستطيع فريقك دراسة المشكلة، وتوجيه أدواته نحو الحل، واختبار النتيجة، والتحقق من أن التطبيق يعمل فعلًا. لا تحتاج إلى فريق قبل التسجيل؛ فصفحة تكوين الفرق ستضعك في فريق.",
    "Read the FAQ": "اقرأ الأسئلة الشائعة",
    "16-page planning record · PDF": "سجل تخطيط من 16 صفحة · PDF",
    "18-page planning record · PDF": "سجل تخطيط من 18 صفحة · PDF",
    "22-page planning record · PDF": "سجل تخطيط من 22 صفحة · PDF",
    TEMPLATE: "قالب",
    "Objectives, outline, exercises and review": "الأهداف، والمخطط، والتمارين، والمراجعة",
    "100-point evaluation framework": "إطار تقييم من 100 نقطة",
    "Brief, requirements, change event and submission": "الوصف، والمتطلبات، وحدث التغيير، والتسليم",
    "Ownership, tasks, dependencies and decisions": "المسؤوليات، والمهام، والاعتماديات، والقرارات",
    "Guides, references and troubleshooting": "الأدلة، والمراجع، وحل المشكلات",
    "SYS.MSG: CHALLENGE LOCKED UNTIL COMPETITION DAY": "رسالة_النظام: التحدي مقفل حتى يوم المسابقة",
    "You Won't Know What You're Building.": "لن تعرف ما الذي ستبنيه.",
    "Workshops 15–17 September 2026. Competition 19 September 2026. Register your team, learn the workflow, then build without the tutorial.":
      "الورش 15–17 سبتمبر 2026. المسابقة 19 سبتمبر 2026. سجّل فريقك، وتعلّم مسار العمل، ثم ابنِ دون دليل.",
    "Register a Team": "سجّل فريقًا",
    "BRIEF:": "الوصف:",
    LOCKED: "مقفل",
  };

  /* Dates like "24 SEP 2026" appear inside file metadata that is otherwise
   * untranslatable, so months are substituted within the string. */
  var MONTHS = {
    JAN: "يناير",
    FEB: "فبراير",
    MAR: "مارس",
    APR: "أبريل",
    MAY: "مايو",
    JUN: "يونيو",
    JUL: "يوليو",
    AUG: "أغسطس",
    SEP: "سبتمبر",
    OCT: "أكتوبر",
    NOV: "نوفمبر",
    DEC: "ديسمبر",
  };
  var MONTH_RE =
    /(\d{1,2}) (JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) (\d{4})/gi;

  /* Copy generated with live numbers or names ("2 OF 4 PLACES REMAINING",
   * "View profile for …") cannot be a dictionary key. Each pattern rewrites
   * one such template; dates inside the result still get their months
   * translated afterwards. */
  var PATTERNS = [
    [/^(\d+) OF (\d+) PLACES REMAINING$/, "$1 من $2 مقاعد متاحة"],
    [/^(\d+) of (\d+) filled$/, "$1 من $2 مشغولة"],
    [/^OPENS (.+)$/, "تُفتح $1"],
    [/^(\d+) RECORDS$/, "$1 سجلات"],
    [/^(\d+) PUBLIC FILES$/, "$1 ملفات عامة"],
    [/^(\d+) FILES$/, "$1 ملفات"],
    [/^(\d+) FOLDERS$/, "$1 مجلدات"],
    [/^(\d+) DIRECTORIES$/, "$1 مجلدات"],
    [/^(\d+) items?$/i, "$1 عناصر"],
    [/^(\d+) pages?$/, "$1 صفحات"],
    [/^(\d+) slides$/, "$1 شرائح"],
    [/^YEAR: (\d{4})$/, "السنة: $1"],
    [/^(\d{1,2}:\d{2}) AM LOCAL$/, "$1 ص بالتوقيت المحلي"],
    [/^(\d{1,2}:\d{2}) PM LOCAL$/, "$1 م بالتوقيت المحلي"],
    [/^View profile for (.+)$/, "عرض الملف الشخصي لـ $1"],
  ];

  /* Attributes whose values are read by people or screen readers. */
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  /* Whitespace-normalised lookup, so wrapped source paragraphs match the
   * single-line keys written above. */
  var LOOKUP = {};
  var REVERSE_LOOKUP = {};
  Object.keys(DICT).forEach(function (key) {
    var english = key.replace(/\s+/g, " ").trim();
    var arabic = DICT[key].replace(/\s+/g, " ").trim();
    LOOKUP[english] = DICT[key];
    /* Keep the first English source when two labels intentionally share
     * one Arabic translation. Either source restores readable English. */
    if (!Object.prototype.hasOwnProperty.call(REVERSE_LOOKUP, arabic)) {
      REVERSE_LOOKUP[arabic] = key;
    }
  });

  var originalText = new WeakMap(); // text node -> English source
  var originalAttr = new WeakMap(); // element   -> { attr: English source }
  var applying = false;
  var current = "en";

  function translate(source) {
    var parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(source);
    var lead = parts[1],
      core = parts[2],
      trail = parts[3];
    if (!core) {
      return null;
    }

    var normalised = core.replace(/\s+/g, " ");
    if (Object.prototype.hasOwnProperty.call(LOOKUP, normalised)) {
      return lead + LOOKUP[normalised] + trail;
    }

    var text = normalised;
    var changed = false;
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i][0].test(text)) {
        text = text.replace(PATTERNS[i][0], PATTERNS[i][1]);
        changed = true;
        break;
      }
    }

    MONTH_RE.lastIndex = 0;
    if (MONTH_RE.test(text)) {
      MONTH_RE.lastIndex = 0;
      text = text.replace(MONTH_RE, function (_, day, month, year) {
        return day + " " + MONTHS[month.toUpperCase()] + " " + year;
      });
      changed = true;
    }
    return changed ? lead + text + trail : null;
  }

  /* Dynamic components can be inserted between a language click and the
   * MutationObserver callback. If their first observed value is Arabic,
   * recover the authored English here instead of caching Arabic as source. */
  function englishSource(value) {
    var parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
    var normalised = parts[2].replace(/\s+/g, " ");
    if (Object.prototype.hasOwnProperty.call(REVERSE_LOOKUP, normalised)) {
      return parts[1] + REVERSE_LOOKUP[normalised] + parts[3];
    }
    return value;
  }

  function applyToTextNodes(root, lang) {
    if (!root) {
      return;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var tag = node.parentNode && node.parentNode.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        /* Project names come live from Supabase (project-names.js), in
         * both languages; the dictionary must not overwrite them. */
        if (
          node.parentNode.closest &&
          node.parentNode.closest("[data-project-live]")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    var node;
    while ((node = walker.nextNode())) {
      if (!originalText.has(node)) {
        originalText.set(node, englishSource(node.nodeValue));
      }
      var source = originalText.get(node);
      var next = (lang === "ar" && translate(source)) || source;
      if (node.nodeValue !== next) {
        node.nodeValue = next;
      }
    }
  }

  function applyToAttributes(root, lang) {
    if (!root || root.nodeType !== 1) {
      return;
    }

    var selector = ATTRS.map(function (a) {
      return "[" + a + "]";
    }).join(",");
    var elements = Array.prototype.slice.call(root.querySelectorAll(selector));
    if (root.matches && root.matches(selector)) {
      elements.push(root);
    }

    elements.forEach(function (el) {
      var cache = originalAttr.get(el);
      if (!cache) {
        cache = {};
        originalAttr.set(el, cache);
      }

      ATTRS.forEach(function (attr) {
        if (!el.hasAttribute(attr)) {
          return;
        }
        if (attr === "alt" && el.hasAttribute("data-project-live-alt")) {
          return;
        }
        if (!(attr in cache)) {
          cache[attr] = englishSource(el.getAttribute(attr));
        }
        var source = cache[attr];
        el.setAttribute(attr, (lang === "ar" && translate(source)) || source);
      });
    });
  }

  function apply(root, lang) {
    applying = true;
    applyToTextNodes(root, lang);
    applyToAttributes(root, lang);
    applying = false;
  }

  function setLanguage(lang, persist) {
    current = lang === "ar" ? "ar" : "en";

    var html = document.documentElement;
    html.lang = current;
    html.dir = current === "ar" ? "rtl" : "ltr";

    apply(document.body, current);
    applyToTextNodes(document.querySelector("title"), current);

    var button = document.querySelector(".lang-toggle");
    if (button) {
      button.setAttribute(
        "aria-label",
        current === "ar" ? "Switch to English" : "التبديل إلى العربية",
      );
      button.setAttribute("data-active-lang", current);
      button.querySelectorAll("[data-lang-option]").forEach(function (option) {
        var isActive = option.getAttribute("data-lang-option") === current;
        option.classList.toggle("active", isActive);
        option.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch (e) {
        /* private mode */
      }
    }

    document.dispatchEvent(
      new CustomEvent("acm:languagechange", {
        detail: { language: current },
      }),
    );
  }

  /* The archive page has no <nav>, so the toggle joins its action row. */
  function buildToggle() {
    if (document.querySelector(".lang-toggle")) {
      return;
    }

    var host =
      document.querySelector(".nav-inner") ||
      document.querySelector(".archive-actions");
    if (!host) {
      return;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "lang-toggle mono-meta";
    button.innerHTML =
      '<span data-lang-option="ar">AR</span><span class="lang-divider" aria-hidden="true">/</span><span data-lang-option="en">EN</span>';

    var utilities = host.querySelector(".nav-utilities");
    if (!utilities) {
      utilities = document.createElement("div");
      utilities.className = "nav-utilities";
      var meta = host.querySelector(".nav-meta");
      if (meta) {
        host.insertBefore(utilities, meta);
        utilities.appendChild(meta);
      } else {
        host.appendChild(utilities);
      }
    }
    utilities.appendChild(button);

    button.addEventListener("click", function () {
      setLanguage(current === "ar" ? "en" : "ar", true);
    });
  }

  function stored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function start() {
    buildToggle();
    setLanguage(stored() === "ar" ? "ar" : "en", false);

    /* team.js, projects.js and archive.js rewrite parts of the page after
     * load; translate whatever they insert. */
    if ("MutationObserver" in window) {
      new MutationObserver(function (records) {
        if (applying) {
          return;
        }
        records.forEach(function (record) {
          Array.prototype.forEach.call(record.addedNodes, function (node) {
            if (node.nodeType === 1) {
              apply(node, current);
            } else if (node.nodeType === 3) {
              applyToTextNodes(node.parentNode, current);
            }
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.ACMLang = {
    get: function () {
      return current;
    },
    set: function (lang) {
      setLanguage(lang, true);
    },
  };
})();
