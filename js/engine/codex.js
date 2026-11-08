/* Codex entries. Each milestone popup is one of these, so the codex can replay everything. */
(function () {
  const S = window.Spark;
  const entries = [
    // ---- Stage 1: chemistry ----
    { id: 'vents', stage: 1, hypothesis: true, title: 'Alkaline hydrothermal vents', years: 'about 4.0 billion years ago',
      body: 'Warm, alkaline water seeping through iron-sulfur rock into an acidic ocean makes a natural chemical gradient and tiny mineral pores that act like reaction vessels. One leading hypothesis says life started in pores like this. The main rival idea is shallow surface pools that dried and refilled, driven by sunlight and lightning. Both are still being tested.' },
    { id: 'building-blocks', stage: 1, title: 'Building blocks make themselves', years: 'about 4.0 billion years ago',
      body: 'Give simple gases like CO2, hydrogen and ammonia some energy and a catalyst, and amino acids and nucleotide parts form on their own. Miller and Urey showed this with sparks in 1953, and the same molecules turn up inside meteorites. No life needed, just chemistry pushed uphill.' },
    { id: 'energy', stage: 1, title: 'Why energy is the point', years: 'about 4.0 billion years ago',
      body: 'Molecules sitting in equilibrium do nothing interesting. Building blocks only form when something keeps pushing the system away from equilibrium: vent heat, a proton gradient, or lightning. Life is still that same trick: it is a steady flow of energy, not a thing.' },

    // ---- Stage 2: polymerization ----
    { id: 'hydrolysis', stage: 2, title: 'Water breaks chains', years: 'about 4.0 billion years ago',
      body: 'Linking two building blocks releases a water molecule, so in open water the reaction tends to run backwards: chains fall apart. This is the water paradox. Life needs water, but water is bad at letting polymers form.' },
    { id: 'surfaces', stage: 2, hypothesis: true, title: 'Minerals and surfaces as scaffolds', years: 'about 4.0 billion years ago',
      body: 'Clay and mineral surfaces hold building blocks close together and in the right orientation, and they shield new bonds from water. Wet-dry cycles at a shoreline or heat pumping inside a vent pore can do the same job. Which surface mattered most is still debated, but some scaffold was almost certainly needed.' },
    { id: 'rna', stage: 2, title: 'RNA: information that can act', years: 'about 4.0 billion years ago',
      body: 'RNA is special because its sequence carries information like DNA, but the folded strand can also do chemistry like a protein. That double role is why many researchers think RNA, not DNA or protein, came first. This stage of your strand is still just a short random chain.' },

    // ---- Stage 3: protocell ----
    { id: 'vesicles', stage: 3, title: 'Fatty acids self-assemble', years: 'about 3.9 billion years ago',
      body: 'Fatty acids have a water-loving head and a water-hating tail. Above a certain concentration they snap together into bubbles called vesicles with no help at all. Membranes do not need to be built. They happen.' },
    { id: 'compartment', stage: 3, title: 'Why a compartment matters', years: 'about 3.9 billion years ago',
      body: 'A replicating RNA in open water helps every neighbor equally, so a better copier gets no reward. Trap it in a membrane and its products stay with it. That is what lets selection act on an individual instead of on a soup.' },

    // ---- Stage 4: RNA world ----
    { id: 'copying', stage: 4, title: 'Copying is never perfect', years: 'about 3.9 billion years ago',
      body: 'Every copy has a chance of a wrong base. Most changes do nothing or make the copy worse, but a few make it copy faster or more accurately. Variation is not a design feature. It is an unavoidable side effect of chemistry.' },
    { id: 'selection', stage: 4, title: 'The first natural selection', years: 'about 3.9 billion years ago',
      body: 'Nucleotides are limited, so faster copiers crowd out slower ones without anyone choosing. Repeat that for thousands of generations and the population climbs toward whatever copies best. Nothing is trying. Selection just falls out of copying with errors in a crowded space.' },
    { id: 'rna-world', stage: 4, hypothesis: true, title: 'The RNA world hypothesis', years: 'about 3.9 to 3.8 billion years ago',
      body: 'The idea: before DNA and proteins, RNA molecules both stored information and catalyzed their own copying. Evidence includes lab-made RNA enzymes that copy RNA, and the fact that the ribosome, which builds every protein, is itself mostly RNA. It is widely favored but not proven, and nobody has made a fully self-copying RNA yet.' },

    // ---- Stage 5: first cell ----
    { id: 'gradient', stage: 5, title: 'Proton gradients make ATP', years: 'about 3.8 billion years ago',
      body: 'A membrane with more protons on one side is like a charged battery. Let protons flow back through a tiny rotary machine called ATP synthase and it spins, pressing phosphate onto ADP to make ATP. Peter Mitchell proposed this in 1961 and was laughed at for years.' },
    { id: 'pumps', stage: 5, title: 'Pumping to keep the battery charged', years: 'about 3.8 billion years ago',
      body: 'A free natural gradient runs out as protons leak in. Living cells fix this by running electrons from food or hydrogen down an energy hill and using that to pump protons back out. Every cell alive today, from bacteria to you, still uses this exact design.' },
    { id: 'luca', stage: 5, title: 'The last universal common ancestor', years: 'about 3.8 to 3.5 billion years ago',
      body: 'Every living thing shares ribosomes, ATP, the genetic code and membrane energy. That points to a single ancestor population, nicknamed LUCA. It was probably a hydrogen-eating, heat-loving microbe, already quite complex. Everything before it in this game is reconstruction, not fossil.' },

    // ---- Stage 6: fission ----
    { id: 'fission', stage: 6, title: 'Binary fission', years: 'about 3.5 billion years ago',
      body: 'Grow, copy the genome, pinch in half. That is still how bacteria reproduce, and in good conditions some do it every 20 minutes. One cell becomes two identical cells, give or take copying errors.' },
    { id: 'traits', stage: 6, title: 'Mutations become traits', years: 'about 3.5 billion years ago',
      body: 'A changed gene can change a protein, and that changes something you can see: how fast a cell swims, how big it gets, whether it has a tougher coat. Selection never sees the gene. It only sees the trait and whether the owner left descendants.' },
    { id: 'competition', stage: 6, title: 'Populations evolve, individuals do not', years: 'about 3.5 billion years ago',
      body: 'No single cell got faster. Faster cells just left more copies, so the average shifted. The oldest convincing fossils of cells are stromatolites from around 3.5 billion years ago, so by now life was already everywhere there was water.' },

    // ---- Stage 7: endosymbiosis ----
    { id: 'surface-volume', stage: 7, title: 'The surface-to-volume trap', years: 'about 2.0 billion years ago',
      body: 'A cell makes energy at its membrane but spends it throughout its volume. Double the radius and the volume grows eight times while the surface grows only four. Bacteria stayed small for two billion years partly because of this arithmetic.' },
    { id: 'oxygen', stage: 7, title: 'The Great Oxidation', years: 'about 2.4 billion years ago',
      body: 'Photosynthesizing bacteria filled the air and water with oxygen, a reactive poison for most life at the time. Some bacteria learned to use it, burning food with oxygen for far more energy. Having a lodger who can do that was suddenly very valuable.' },
    { id: 'endosymbiosis', stage: 7, title: 'Mitochondria were bacteria', years: 'about 2.0 to 1.8 billion years ago',
      body: 'An archaeon-like host engulfed an oxygen-breathing bacterium and, instead of digesting it, kept it. Its descendants are your mitochondria, which still have their own DNA and divide on their own. Thousands of internal power plants broke the surface-to-volume limit and paid for big genomes and complex cells.' },

    // ---- Stage 8: sex ----
    { id: 'sex', stage: 8, title: 'Sex shuffles genes', years: 'about 1.5 to 1.2 billion years ago',
      body: 'Two parents each contribute half their genes, so every offspring is a new combination. Clones can only improve by waiting for a lucky mutation. A sexual population tests many combinations at once, which is why it adapts faster when the environment moves.' },
    { id: 'red-queen', stage: 8, title: 'Running from parasites', years: 'about 1.2 billion years ago',
      body: 'Parasites evolve to attack whatever genotype is most common. A clone colony is one genotype, so once a parasite cracks it, it cracks everyone. Mixing genes keeps the next generation a moving target. This Red Queen idea is one of the best supported explanations for why sex persists despite its cost.' },

    // ---- Stage 9: multicellularity ----
    { id: 'multicell', stage: 9, title: 'Cells that stay together', years: 'about 800 to 600 million years ago',
      body: 'Multicellularity evolved independently at least 25 times, in algae, fungi, animals and more. The first step is tiny: daughter cells fail to separate. Being a clump already helps, because a predator that can swallow one cell often cannot swallow eight.' },
    { id: 'specialization', stage: 9, title: 'Division of labor', years: 'about 700 to 600 million years ago',
      body: 'Once cells share a body and a genome, they can afford to specialize: some feed, some move, some sense. A cell that only moves would die alone, but inside a body it is fed by the others. Specialization is what turns a colony into an organism.' },

    // ---- Stage 10: nervous system ----
    { id: 'nerve-net', stage: 10, title: 'The nerve net: react only', years: 'about 600 to 550 million years ago',
      body: 'Jellyfish and their relatives have neurons spread out in a web with no center. Touch one spot and the whole body contracts. It works, but it only answers to what just touched it. There is no way to compare options or plan a route.' },
    { id: 'cephalization', stage: 10, title: 'Putting the sensors at the front', years: 'about 560 to 540 million years ago',
      body: 'Animals that move in one direction meet the world head first, so sensors cluster there. Nerves that process those sensors cluster right behind them to keep wiring short. That cluster is the first brain. Flatworm-like animals show the basic layout, and all vertebrate, insect and mollusc brains are elaborations of it.' },
    { id: 'brain', stage: 10, title: 'From reacting to choosing', years: 'about 540 million years ago to now',
      body: 'A central brain can hold two signals at once, weigh them and pick, instead of firing whatever reflex arrived first. That is the difference between flinching and deciding. Everything you did in this game, including reading this sentence, runs on that upgrade.' }
  ];
  const byId = {}; entries.forEach(e => byId[e.id] = e);
  S.Codex = { entries, get(id) { return byId[id]; }, forStage(n) { return entries.filter(e => e.stage === n); } };
})();
