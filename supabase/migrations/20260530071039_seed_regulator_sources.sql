-- one source row per distinct endpoint; prevents accidentally polling the same feed twice
alter table sources add constraint sources_base_url_unique unique (base_url);

insert into sources (agency, source_type, ingestion_method, base_url) values
  ('APRA', 'regulator', 'html_scrape', 'https://www.apra.gov.au/news-and-publications'),
  ('ASIC', 'regulator', 'html_scrape', 'https://www.asic.gov.au/newsroom'),
  ('AUSTRAC', 'regulator', 'html_scrape', 'https://www.austrac.gov.au/business/updates?field_article_type_terms_target_id=186'),
  ('TGA', 'regulator', 'html_scrape', 'https://www.tga.gov.au/news'),
  ('AER', 'regulator', 'html_scrape', 'https://www.aer.gov.au/news'),
  ('Federal Register of Legislation', 'regulator', 'api',         'https://www.legislation.gov.au'),
  ('ACCC', 'regulator', 'html_scrape', 'https://www.accc.gov.au/media'),
  ('OAIC', 'regulator', 'html_scrape', 'https://www.oaic.gov.au/newsroom')
on conflict (base_url) do nothing;