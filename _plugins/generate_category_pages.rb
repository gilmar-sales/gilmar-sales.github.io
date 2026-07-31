module Jekyll
  class CategoryPage < Page
    def initialize(site, category)
      @site = site
      @base = site.source
      @dir  = File.join("topics", Utils.slugify(category))
      @name = "index.html"

      process(@name)

      self.data = {
        "layout" => "category",
        "title" => category,
        "category" => category,
      }
    end
  end

  class CategoryPageGenerator < Generator
    safe true
    priority :low

    def generate(site)
      site.categories.each_key do |category|
        site.pages << CategoryPage.new(site, category)
      end
    end
  end
end
