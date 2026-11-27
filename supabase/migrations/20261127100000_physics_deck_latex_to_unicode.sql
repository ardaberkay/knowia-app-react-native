-- Fizik destesi: LaTeX -> düz unicode metin (matematik betiğinin aynısı).
-- Kurallar eski components/ui/MathText.js toUnicode() ile aynı.
--
-- KULLANIM (SQL editöründe tek seferde çalıştır):
--   1) Deste bulunamazsa betik durur.
--   2) Yedek tablo cards_backup_physics_20261127 oluşur (zaten varsa üzerine yazmaz).
--   3) Kartlar dönüştürülür; değişen kartlar sonuç olarak listelenir.
--   4) Uygulamada desteye bak. Kötüyse en alttaki GERİ AL bloğunu, iyiyse DROP satırını çalıştır.

do $$
begin
  if not exists (select 1 from public.decks where name ilike 'Fizik Form%') then
    raise exception 'Fizik Form%% ile baslayan deste bulunamadi; destenin tam adini kontrol et.';
  end if;
end $$;

create table if not exists public.cards_backup_physics_20261127 as
select c.*
from public.cards c
join public.decks d on d.id = c.deck_id
where d.name ilike 'Fizik Form%';
alter table public.cards_backup_physics_20261127 enable row level security;

create or replace function pg_temp.latex_to_unicode(raw text) returns text
language plpgsql as $fn$
declare
  s   text := raw;
  m   text[];
  sym record;
  sup_from constant text := '0123456789abcdefghijklmnoprstuvwxyz+-=()';
  sup_to   constant text := '⁰¹²³⁴⁵⁶⁷⁸⁹ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ⁺⁻⁼⁽⁾';
  sub_from constant text := '0123456789aehijklmnoprstuvx+-=()';
  sub_to   constant text := '₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₊₋₌₍₎';
begin
  if s is null or s = '' then return s; end if;

  -- Matematik ayraçları: $$..$$, $..$, \(..\), \[..\]
  s := replace(s, '$', '');
  s := regexp_replace(s, '\\[()\[\]]', '', 'g');
  -- \\ satır sonu, \, \; \: \! \  boşluk komutları
  s := regexp_replace(s, '\\\\', E'\n', 'g');
  s := regexp_replace(s, '\\[,;: ]', ' ', 'g');
  s := regexp_replace(s, '\\!', '', 'g');

  s := regexp_replace(s, '\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}', '(\1)/(\2)', 'g');

  -- \sqrt[n]{x} -> ⁿ√(x)
  loop
    m := regexp_match(s, '\\sqrt\[([^\]]+)\]\s*\{([^}]*)\}');
    exit when m is null;
    s := regexp_replace(s, '\\sqrt\[[^\]]+\]\s*\{[^}]*\}',
           replace(translate(m[1], sup_from, sup_to) || '√(' || m[2] || ')', '\', '\\'));
  end loop;
  s := regexp_replace(s, '\\sqrt\s*\{([^}]*)\}', '√(\1)', 'g');
  s := regexp_replace(s, '\\binom\s*\{([^}]*)\}\s*\{([^}]*)\}', 'C(\1,\2)', 'g');

  s := regexp_replace(s, '\\overline\{([^}]*)\}',  E'\\1\u0305', 'g');
  s := regexp_replace(s, '\\underline\{([^}]*)\}', E'\\1\u0332', 'g');
  s := regexp_replace(s, '\\hat\{([^}]*)\}',       E'\\1\u0302', 'g');
  s := regexp_replace(s, '\\vec\{([^}]*)\}',       E'\\1\u20D7', 'g');
  s := regexp_replace(s, '\\bar\{([^}]*)\}',       E'\\1\u0304', 'g');
  s := regexp_replace(s, '\\dot\{([^}]*)\}',       E'\\1\u0307', 'g');
  s := regexp_replace(s, '\\ddot\{([^}]*)\}',      E'\\1\u0308', 'g');
  s := regexp_replace(s, '\\tilde\{([^}]*)\}',     E'\\1\u0303', 'g');
  s := regexp_replace(s, '\\(text|mathrm|mathbf|mathbb|mathcal|operatorname)\{([^}]*)\}', '\2', 'g');
  s := regexp_replace(s, '\\(left|right)\s*', '', 'g');
  s := regexp_replace(s, '\\(begin|end)\{[^}]*\}', '', 'g');
  s := regexp_replace(s, '\\(overbrace|underbrace)\{([^}]*)\}', '\2', 'g');

  -- Semboller (uzun komutlar önce)
  for sym in
    select k, v from (values
      ('alpha','α'),('beta','β'),('gamma','γ'),('delta','δ'),('epsilon','ε'),('varepsilon','ε'),
      ('zeta','ζ'),('eta','η'),('theta','θ'),('vartheta','ϑ'),('iota','ι'),('kappa','κ'),
      ('lambda','λ'),('mu','μ'),('nu','ν'),('xi','ξ'),('pi','π'),('rho','ρ'),('sigma','σ'),
      ('tau','τ'),('upsilon','υ'),('phi','φ'),('varphi','φ'),('chi','χ'),('psi','ψ'),('omega','ω'),
      ('Gamma','Γ'),('Delta','Δ'),('Theta','Θ'),('Lambda','Λ'),('Xi','Ξ'),('Pi','Π'),
      ('Sigma','Σ'),('Upsilon','Υ'),('Phi','Φ'),('Psi','Ψ'),('Omega','Ω'),
      ('infty','∞'),('partial','∂'),('nabla','∇'),
      ('int','∫'),('iint','∬'),('iiint','∭'),('oint','∮'),('sum','∑'),('prod','∏'),
      ('cdot','·'),('times','×'),('div','÷'),('pm','±'),('mp','∓'),
      ('circ','∘'),('bullet','•'),('star','⋆'),
      ('leq','≤'),('le','≤'),('geq','≥'),('ge','≥'),('neq','≠'),('ne','≠'),('equiv','≡'),
      ('sim','∼'),('cong','≅'),('approx','≈'),('propto','∝'),('ll','≪'),('gg','≫'),
      ('in','∈'),('notin','∉'),('subset','⊂'),('supset','⊃'),('subseteq','⊆'),('supseteq','⊇'),
      ('cup','∪'),('cap','∩'),('bigcup','⋃'),('bigcap','⋂'),('emptyset','∅'),('varnothing','∅'),
      ('forall','∀'),('exists','∃'),('nexists','∄'),('neg','¬'),('land','∧'),('lor','∨'),
      ('angle','∠'),('perp','⊥'),('parallel','∥'),('triangle','△'),('degree','°'),
      ('to','→'),('rightarrow','→'),('leftarrow','←'),('Rightarrow','⇒'),('Leftarrow','⇐'),
      ('Leftrightarrow','⇔'),('implies','⇒'),('iff','⇔'),
      ('lim','lim'),('sin','sin'),('cos','cos'),('tan','tan'),('cot','cot'),('sec','sec'),('csc','csc'),
      ('arcsin','arcsin'),('arccos','arccos'),('arctan','arctan'),
      ('log','log'),('ln','ln'),('exp','exp'),('det','det'),('min','min'),('max','max'),
      ('sup','sup'),('inf','inf'),('mod','mod'),('gcd','gcd'),
      ('ldots','…'),('cdots','⋯'),('dots','…')
    ) as t(k, v)
    order by length(k) desc
  loop
    s := regexp_replace(s, '\\' || sym.k || '(?![a-zA-Z])', sym.v, 'g');
  end loop;

  -- Alt / üst indisler
  loop
    m := regexp_match(s, '_\{([^}]*)\}');
    exit when m is null;
    s := regexp_replace(s, '_\{[^}]*\}', replace(translate(m[1], sub_from, sub_to), '\', '\\'));
  end loop;
  loop
    m := regexp_match(s, '_([a-zA-Z0-9])');
    exit when m is null;
    s := regexp_replace(s, '_[a-zA-Z0-9]', translate(m[1], sub_from, sub_to));
  end loop;
  loop
    m := regexp_match(s, '\^\{([^}]*)\}');
    exit when m is null;
    s := regexp_replace(s, '\^\{[^}]*\}', replace(translate(m[1], sup_from, sup_to), '\', '\\'));
  end loop;
  loop
    m := regexp_match(s, '\^([a-zA-Z0-9])');
    exit when m is null;
    s := regexp_replace(s, '\^[a-zA-Z0-9]', translate(m[1], sup_from, sup_to));
  end loop;

  s := regexp_replace(s, '[{}]', '', 'g');
  s := regexp_replace(s, '\\[a-zA-Z]+', '', 'g');
  s := regexp_replace(s, '[ \t]{2,}', ' ', 'g');
  return btrim(s);
end
$fn$;

-- Sadece LaTeX içeren alanlar dönüştürülür; diğerleri olduğu gibi kalır.
create or replace function pg_temp.fix_math(f text) returns text
language sql as $$
  select case when f ~ '\\[a-zA-Z(\[]|\^|_\{|\$' then pg_temp.latex_to_unicode(f) else f end
$$;

update public.cards c
set question = pg_temp.fix_math(c.question),
    answer   = pg_temp.fix_math(c.answer),
    example  = pg_temp.fix_math(c.example),
    note     = pg_temp.fix_math(c.note)
from public.decks d
where d.id = c.deck_id
  and d.name ilike 'Fizik Form%'
  and (c.question is distinct from pg_temp.fix_math(c.question)
    or c.answer   is distinct from pg_temp.fix_math(c.answer)
    or c.example  is distinct from pg_temp.fix_math(c.example)
    or c.note     is distinct from pg_temp.fix_math(c.note))
returning c.id, c.question, c.answer;

-- GERİ AL (gerekirse):
-- update public.cards c
-- set question = b.question, answer = b.answer, example = b.example, note = b.note
-- from public.cards_backup_physics_20261127 b
-- where b.id = c.id;

-- Deste uygulamada doğru görünüyorsa yedeği sil:
-- drop table public.cards_backup_physics_20261127;
