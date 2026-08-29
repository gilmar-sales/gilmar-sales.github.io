source "https://rubygems.org"

ruby "~> 3.4"

gem "jekyll", "~> 4.4"
gem "webrick"
gem "erb"

# Ruby 3.4+ no longer bundles these stdlib gems by default
gem "csv"
gem "base64"
gem "bigdecimal"
gem "logger"

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-paginate", "~> 1.1.0"
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", "~> 1.2"
  gem "tzinfo-data"
end
