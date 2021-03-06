/* Mutations */

const insertAuthorArticleMutation = `mutation MyMutation($article_id: Int!, $author_id: Int!) {
  insert_author_articles(objects: {article_id: $article_id, author_id: $author_id}, on_conflict: {constraint: author_articles_article_id_author_id_key, update_columns: article_id}) {
    affected_rows
  }
}`;

const insertAuthorPageMutation = `mutation MyMutation($page_id: Int!, $author_id: Int!) {
  insert_author_pages(objects: {page_id: $page_id, author_id: $author_id}, on_conflict: {constraint: author_pages_page_id_author_id_key, update_columns: page_id}) {
    affected_rows
  }
}`;

const insertArticleGoogleDocMutation = `mutation MyMutation($locale_code: String!, $headline: String!, $published: Boolean, $category_id: Int!, $slug: String!, $document_id: String, $url: String, $custom_byline: String, $content: jsonb, $facebook_description: String, $facebook_title: String, $search_description: String, $search_title: String, $twitter_description: String, $twitter_title: String) {
  insert_articles(objects: {article_translations: {data: {headline: $headline, locale_code: $locale_code, published: $published, content: $content, custom_byline: $custom_byline, facebook_description: $facebook_description, facebook_title: $facebook_title, search_description: $search_description, search_title: $search_title, twitter_description: $twitter_description, twitter_title: $twitter_title}}, category_id: $category_id, slug: $slug, article_google_documents: {data: {google_document: {data: {document_id: $document_id, locale_code: $locale_code, url: $url}, on_conflict: {constraint: google_documents_organization_id_document_id_key, update_columns: locale_code}}}, on_conflict: {constraint: article_google_documents_article_id_google_document_id_key, update_columns: google_document_id}}}, on_conflict: {constraint: articles_slug_category_id_organization_id_key, update_columns: updated_at}) {
    returning {
      id
      slug
      updated_at
      created_at
      article_google_documents {
        id
        google_document {
          document_id
          locale_code
          url
          id
        }
      }
      category {
        slug
      }
      article_translations(where: { locale_code: {_eq: $locale_code}}, order_by: {id: desc}, limit: 1) {
        id
        article_id
        locale_code
        published
      }
      published_article_translations(where: {locale_code: {_eq: $locale_code}}) {
        article_translation {
          id
          first_published_at
          last_published_at
          locale_code
        }
      }
    }
  }
}`;

const insertGoogleDocMutation = `mutation MyMutation($article_id: Int!, $document_id: String!, $locale_code: String!, $url: String) {
  insert_article_google_documents(objects: {article_id: $article_id, google_document: {data: {document_id: $document_id, locale_code: $locale_code, url: $url}, on_conflict: {constraint: google_documents_organization_id_document_id_key, update_columns: url}}}, on_conflict: {constraint: article_google_documents_article_id_google_document_id_key, update_columns: google_document_id}) {
    affected_rows
  }
}`;

const insertPageGoogleDocsMutation = `mutation MyMutation($slug: String!, $locale_code: String!, $document_id: String, $url: String, $facebook_title: String, $facebook_description: String, $search_title: String, $search_description: String, $headline: String, $twitter_title: String, $twitter_description: String, $content: jsonb, $published: Boolean) {
  insert_pages(objects: {page_google_documents: {data: {google_document: {data: {document_id: $document_id, locale_code: $locale_code, url: $url}, on_conflict: {constraint: google_documents_organization_id_document_id_key, update_columns: document_id}}}, on_conflict: {constraint: page_google_documents_page_id_google_document_id_key, update_columns: google_document_id}}, slug: $slug, page_translations: {data: {published: $published, search_description: $search_description, search_title: $search_title, twitter_description: $twitter_description, twitter_title: $twitter_title, locale_code: $locale_code, headline: $headline, facebook_title: $facebook_title, facebook_description: $facebook_description, content: $content}}}, on_conflict: {constraint: pages_slug_organization_id_key, update_columns: updated_at}) {
    returning {
      id
      slug
      page_google_documents {
        id
        google_document {
          document_id
          locale_code
          url
        }
      }
    }
  }
}`;

const insertTagMutation = `mutation MyMutation($slug: String, $locale_code: String, $title: String, $article_id: Int!) {
  insert_tag_articles(objects: {article_id: $article_id, tag: {data: {slug: $slug, tag_translations: {data: {locale_code: $locale_code, title: $title}, on_conflict: {constraint: tag_translations_tag_id_locale_code_key, update_columns: locale_code}}, published: true}, on_conflict: {constraint: tags_organization_id_slug_key, update_columns: organization_id}}}, on_conflict: {constraint: tag_articles_article_id_tag_id_key, update_columns: article_id}) {
    returning {
      id
      article_id
      tag_id
    }
  }
}`;

const linkDocToArticleMutation = `mutation MyMutation($article_id: Int!, $document_id: String!, $locale_code: String!, $url: String) {
  delete_article_google_documents(where: {article_id: {_eq: $article_id}, google_document: {locale_code: {_eq: $locale_code}}}) {
    affected_rows
  }
  insert_article_google_documents(objects: {article_id: $article_id, google_document: {data: {document_id: $document_id, locale_code: $locale_code, url: $url}, on_conflict: {constraint: google_documents_organization_id_document_id_key, update_columns: url}}}, on_conflict: {constraint: article_google_documents_article_id_google_document_id_key, update_columns: google_document_id}) {
    returning {
      article_id
      article {
        slug
      }
    }
  }
}`;

const upsertPublishedArticleTranslationMutation = `mutation MyMutation($article_id: Int = 10, $article_translation_id: Int = 10, $locale_code: String = "") {
  insert_published_article_translations(objects: {article_id: $article_id, article_translation_id: $article_translation_id, locale_code: $locale_code}, on_conflict: {constraint: published_article_translations_article_id_locale_code_key, update_columns: article_translation_id}) {
    affected_rows
    returning {
      article_translation {
        id
        first_published_at
        last_published_at
        locale_code
        article_id
      }
    }
  }
}`;

const unpublishArticleMutation = `mutation MyMutation($article_id: Int!, $locale_code: String!) {
  update_article_translations(where: {article_id: {_eq: $article_id}, locale_code: {_eq: $locale_code}}, _set: {published: false}) {
    affected_rows
  }
}`;

/* Queries */

const getArticleByGoogleDocQuery = `query MyQuery($doc_id: String!) {
  articles(where: {article_google_documents: {google_document: {document_id: {_eq: $doc_id}}}}) {
    id
    slug
    category {
      id
      slug
      title
    }
    author_articles {
      author {
        id
        name
        slug
      }
    }
    article_google_documents(where: {google_document: {document_id: {_eq: $doc_id}}}) {
      google_document {
        document_id
        locale_code
        url
      }
    }
  }
  authors {
    id
    slug
    name
  }
  categories {
    id
    slug
    category_translations(where: {locale_code: {_eq: "en-US"}}) {
      title
    }
  }
  organization_locales {
    locale {
      code
      name
    }
  }
  tags {
    id
    slug
    tag_translations(where: {locale_code: {_eq: "en-US"}}) {
      title
    }
  }
}`;

const getPageTranslationForIdAndLocale = `query MyQuery($doc_id: String!, $page_id: Int, $locale_code: String!) {
  page_translations(where: {page_id: {_eq: $page_id}, locale_code: {_eq: $locale_code}}, limit: 1, order_by: {id: desc}) {
    content
    facebook_description
    facebook_title
    first_published_at
    headline
    id
    last_published_at
    locale_code
    published
    search_description
    search_title
    twitter_description
    twitter_title
  }

  pages(where: {page_google_documents: {google_document: {document_id: {_eq: $doc_id}}}}) {
    id
    slug
    author_pages {
      author {
        id
        name
        slug
      }
    }
    page_google_documents(where: {google_document: {document_id: {_eq: $doc_id}}}) {
      google_document {
        document_id
        locale_code
        url
      }
    }
  }
  authors {
    id
    slug
    name
  }
  page_google_documents(where: {page_id: {_eq: $page_id}}) {
    google_document {
      document_id
      locale_code
      url
    }
    page_id
  }
  organization_locales {
    locale {
      code
      name
    }
  }
}`;

const getArticleTranslationForIdAndLocale = `query MyQuery($doc_id: String!, $article_id: Int, $locale_code: String!) {
  article_translations(where: {article_id: {_eq: $article_id}, locale_code: {_eq: $locale_code}}, limit: 1, order_by: {id: desc}) {
    content
    custom_byline
    facebook_description
    facebook_title
    first_published_at
    headline
    id
    last_published_at
    locale_code
    published
    search_description
    search_title
    twitter_description
    twitter_title
  }

  articles(where: {article_google_documents: {google_document: {document_id: {_eq: $doc_id}}}}) {
    id
    slug
    category {
      id
      slug
      title
    }
    author_articles {
      author {
        id
        name
        slug
      }
    }
    article_google_documents(where: {google_document: {document_id: {_eq: $doc_id}}}) {
      google_document {
        document_id
        locale_code
        url
      }
    }
  }
  authors {
    id
    slug
    name
  }
  categories {
    id
    slug
    category_translations(where: {locale_code: {_eq: $locale_code}}) {
      title
    }
  }
  article_google_documents(where: {article_id: {_eq: $article_id}}) {
    google_document {
      document_id
      locale_code
      url
    }
    article_id
  }
  organization_locales {
    locale {
      code
      name
    }
  }
  tags {
    id
    slug
    tag_translations(where: {locale_code: {_eq: $locale_code}}) {
      title
    }
  }
  published_article_translations(where: {locale_code: {_eq: $locale_code}, article_id: {_eq: $article_id}}) {
    article_translation {
      id
      first_published_at
      last_published_at
      locale_code
    }
  }
}`

const getPageForGoogleDocQuery = `query MyQuery($doc_id: String!) {
  pages(where: {page_google_documents: {google_document: {document_id: {_eq: $doc_id} }}}) {
    id
    slug
    page_google_documents(where: {google_document: {document_id: {_eq: $doc_id}}}) {
      google_document {
        document_id
        locale_code
        url
      }
    }
    author_pages {
      author {
        name
        id
        slug
      }
    }
  }
  authors {
    id
    slug
    name
  }
  organization_locales {
    locale {
      code
      name
    }
  }
}`;

const lookupArticleByGoogleDocQuery = `query MyQuery($document_id: String) {
  article_google_documents(where: {google_document: {document_id: {_eq: $document_id}}}) {
    google_document {
      document_id
      locale_code
      id
      organization_id
      url
    }
    article {
      slug
      created_at
      updated_at
    }
  }
}`;

const searchArticlesByHeadlineQuery = `query MyQuery($locale_code: String!, $term: String!) {
  articles(where: {article_translations: {headline: {_ilike: $term}, locale_code: {_eq: $locale_code}}}) {
    id
    slug
    category {
      slug
    }
    article_translations(where: {locale_code: {_eq: $locale_code}}) {
      headline
    }
  }
  organization_locales {
    locale {
      code
      name
    }
  }
}`;

const getHomepageFeaturedArticles = `query MyQuery {
  homepage_layout_datas {
    article_priority_1
    article_priority_2
    article_priority_3
  }
}`