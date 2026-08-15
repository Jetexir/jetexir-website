---
title: Wishlist
category: Product
icon: wishlist
summary: Let customers save products they love and come back to buy them later.
order: 4
features:
  - Wishlist button on shop and product pages
  - Position it before or after "Add to cart", or above the thumbnail
  - Dedicated page showing all saved products
  - Choose the button icon from available options
  - Auto-remove purchased products from the wishlist after checkout
  - Convert saved products to cart in one click
---

Give shoppers a reason to return with a powerful wishlist feature. Customers can save products they like, review
everything on a dedicated wishlist page, and move items straight into the cart whenever they're ready.

You control where the wishlist button appears, before or after the "Add to cart" button, or above the product thumbnail,
and which icon it uses. Once an order is placed, purchased products are removed from the wishlist automatically, so
saved lists stay clean and relevant.

## Developer hooks

### Filters

- **`jetexir_wishlist_list_keys`** — `apply_filters( 'jetexir_wishlist_list_keys', $list_keys, $user_id )` — Filter the
  list of wishlist keys for a user.
- **`jetexir_wishlist_items`** — `apply_filters( 'jetexir_wishlist_items', $wishlist, $user_id )` — Filter the entire
  wishlist array (all lists) for a user.
- **`jetexir_wishlist_list_items`** — `apply_filters( 'jetexir_wishlist_list_items', $wishlist, $list, $user_id )` —
  Filter the items of a single wishlist list.
