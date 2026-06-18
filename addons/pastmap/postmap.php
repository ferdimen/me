<?php
/**
 * Plugin Name: PostMap
 * Description: Yazılara konum ve rotalar ekler. <br/><br/>🟢 [EKLENEN ÖZELLİKLER]:<br/>- Gelişmiş Popup Link Yönetimi (route.png Sol Üstte, ✏️ Düzenle Sağ Üstte)<br/>- OSRM Yol Takip, Sürükleme ve Serbest Çizim Desteği<br/>- Kategori Bazlı Toplu Stil Değiştirici ve İkon Seçimi Önizlemeleri<br/>- 'İlgili Rota' Hızlı Erişim Butonu (Sayfa Üstü)<br/>- Alternatif Waymark Rota Autocomplete Entegrasyonu<br/>- Akıllı Son Rota Sonu Odaklanması<br/>- Tam Ekran Modu (Fullscreen)<br/><br/>🔴 [KALDIRILAN ÖZELLİKLER]:<br/>- Statik harita katman kısıtlamaları<br/>- Eski tip senkronize olmayan koordinat veritabanı şeması. Sürüm 9.6.
 * Version: 9.6
 * Author: Ferdimen
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// =========================================================================
// GITHUB OTOMATİK GÜNCELLEME MOTORU (UPDATE CHECKER)
// =========================================================================
add_filter( 'pre_set_site_transient_update_plugins', 'pm_github_update_checker' );
function pm_github_update_checker( $transient ) {
    if ( empty( $transient->checked ) ) {
        return $transient;
    }

    $username = 'Ferdimen';
    $repository = 'postmap';
    $plugin_slug = plugin_basename(__FILE__);

    $remote_url = "https://api.github.com/repos/{$username}/{$repository}/releases/latest";
    
    $args = array(
        'timeout' => 10,
        'headers' => array(
            'Accept' => 'application/vnd.github.v3+json',
            'User-Agent' => 'WordPress-PostMap-Update-Checker'
        )
    );

    $response = wp_remote_get( $remote_url, $args );

    if ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) == 200 ) {
        $release_info = json_decode( wp_remote_retrieve_body( $response ) );
        if ( $release_info && isset( $release_info->tag_name ) ) {
            $version = str_replace( array('v', 'V'), '', $release_info->tag_name );
            
            if ( version_compare( $version, '9.6', '>' ) ) {
                $obj = new stdClass();
                $obj->slug = 'postmap';
                $obj->plugin = $plugin_slug;
                $obj->new_version = $version;
                $obj->url = "https://github.com/{$username}/{$repository}";
                $obj->package = isset($release_info->zipball_url) ? $release_info->zipball_url : '';
                
                $transient->response[$plugin_slug] = $obj;
            }
        }
    }
    return $transient;
}

add_filter( 'upgrader_source_selection', 'pm_github_upgrader_source_selection', 10, 4 );
function pm_github_upgrader_source_selection( $source, $remote_source, $upgrader, $hook_extra ) {
    global $wp_filesystem;
    if ( isset( $hook_extra['plugin'] ) && $hook_extra['plugin'] === plugin_basename( __FILE__ ) ) {
        $correct_source = trailingslashit( $remote_source ) . 'postmap/';
        if ( $source !== $correct_source ) {
            $wp_filesystem->move( $source, $correct_source );
            return $correct_source;
        }
    }
    return $source;
}

// =========================================================================
// 1. ANA MENÜ VE "F" IKONU ENJEKSİYONU
// =========================================================================
add_action( 'admin_menu', 'pm_ferdimen_addons_menu' );
function pm_ferdimen_addons_menu() {
    global $menu;
    $menu_exists = false;
    foreach ( $menu as $item ) {
        if ( $item[2] == 'ferdimen-addons' ) {
            $menu_exists = true;
            break;
        }
    }

    if ( ! $menu_exists ) {
        $f_icon = 'data:image/svg+xml;base64,' . base64_encode('
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%23a7aaad">
                <path d="M4 2e1h3v-6h5v-3H7V8h6V5H7V2H4v18z"/>
            </svg>
        ');
        add_menu_page( 'Ferdimen Addons', 'Ferdimen Addons', 'manage_options', 'ferdimen-addons', 'pm_ferdimen_addons_main_page', $f_icon, 81 );
    }

    add_submenu_page( 'ferdimen-addons', 'PostMap Ayarları', 'PostMap', 'manage_options', 'wp-to-map-json', 'pm_postmap_admin_page' );
}

function pm_ferdimen_addons_main_page() {
    ?>
    <div class="wrap" style="margin-top: 20px;">
        <div style="margin-bottom: 25px;">
            <img src="https://ferdimen.github.io/me/img/logo.png" style="max-height: 80px; width: auto; display: block;" alt="Ferdimen Logo" />
        </div>
        <h1>Ferdimen Addons Merkezi</h1>
        <p>Geliştirdiğin tüm özel WordPress eklentilerini ve araçlarını bu çatı altından yönetebilirsin.</p>
        <table class="wp-list-table widefat fixed striping" style="margin-top: 20px; max-width: 800px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr>
                    <th style="padding: 12px; font-weight: bold;">Eklenti Adı</th>
                    <th style="padding: 12px; font-weight: bold; width: 120px;">Mevcut Sürüm</th>
                    <th style="padding: 12px; font-weight: bold; width: 320px;">Durum / İşlem</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 15px; vertical-align: middle;"><strong>PostMap</strong></td>
                    <td style="padding: 15px; vertical-align: middle;"><code>9.6</code></td>
                    <td style="padding: 15px; vertical-align: middle;">Eklenti aktif ve kararlı çalışıyor. Güncellemeler otomatik denetlenir.</td>
                </tr>
            </tbody>
        </table>
    </div>
    <?php
}

// =========================================================================
// 2. DİNAMİK KLASÖR TARAMA VE YARDIMCI MOTORLAR
// =========================================================================
function pm_get_local_pin_images() {
    $pins = array();
    $pins['leaflet-default'] = array('url' => 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', 'name' => 'Standart Leaflet', 'is_system' => true);
    $pin_dir = plugin_dir_path( __FILE__ ) . 'data/img/'; $pin_url = plugin_dir_url( __FILE__ ) . 'data/img/';
    if ( is_dir( $pin_dir ) ) {
        $files = glob( $pin_dir . '*.png' );
        if ( $files ) {
            foreach ( $files as $file ) {
                $filename = basename( $file ); $key = pathinfo( $filename, PATHINFO_FILENAME );
                $pins[$key] = array('url' => $pin_url . $filename, 'name' => ucwords( str_replace( array('-', '_'), ' ', $key ) ), 'is_system' => false);
            }
        }
    }
    return $pins;
}

function pm_get_last_route_end_coords() {
    $args = array(
        'post_type' => 'post',
        'posts_per_page' => 1,
        'post_status' => 'any',
        'meta_query' => array(
            array('key' => '_wm_tahmini_rota', 'compare' => 'EXISTS')
        ),
        'orderby' => 'modified',
        'order' => 'DESC'
    );
    $latest_posts = get_posts($args);
    if (!empty($latest_posts)) {
        $rota_json = get_post_meta($latest_posts[0]->ID, '_wm_tahmini_rota', true);
        $coords = json_decode($rota_json, true);
        if (is_array($coords) && count($coords) > 0) {
            return end($coords);
        }
    }
    return array(41.2112, 27.7724);
}

function pm_get_post_sub_category_id($post_id) {
    $categories = wp_get_post_categories($post_id, array('fields' => 'all'));
    $bisiklet_turlari_id = null;
    foreach($categories as $cat) {
        if(mb_strtoupper($cat->name, 'UTF-8') === 'BİSİKLET TURLARI' && $cat->parent == 0) {
            $bisiklet_turlari_id = $cat->term_id;
            break;
        }
    }
    if(!$bisiklet_turlari_id) {
        foreach($categories as $cat) { if($cat->parent > 0) { return $cat->term_id; } }
        return !empty($categories) ? $categories[0]->term_id : 0;
    }
    foreach($categories as $cat) { if($cat->parent == $bisiklet_turlari_id) { return $cat->term_id; } }
    return $bisiklet_turlari_id;
}

function pm_is_feature_active($feature_key) {
    $features = get_option('pm_active_features', array(
        'osrm_routing' => '1',
        'line_arrows'  => '1',
        'popup_edit'   => '1',
        'subcat_fade'  => '1',
        'fullscreen'   => '1'
    ));
    return isset($features[$feature_key]) && $features[$feature_key] === '1';
}

// =========================================================================
// 3. AYARLAR VE YÖNETİM PANELİ (STİL AYARLARI, BULK VE İKON ÖNİZLEMELERİ)
// =========================================================================
add_action( 'admin_init', 'pm_eklenti_ayarlarini_kaydet' );
function pm_eklenti_ayarlarini_kaydet() {
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_harita_altlik' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_varsayilan_pin' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_default_line_color' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_secondary_line_color' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_active_features' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_popup_show_waymark', array('default' => '1') );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_popup_show_blog', array('default' => '1') );
}

function pm_postmap_admin_page() {
    if ( isset($_POST['pm_bulk_cat_submit']) && check_admin_referer('pm_bulk_cat_nonce_action', 'pm_bulk_cat_nonce') ) {
        $selected_cats = isset($_POST['pm_bulk_categories']) ? array_map('intval', $_POST['pm_bulk_categories']) : array();
        $target_icon   = sanitize_text_field($_POST['pm_bulk_icon']);
        $target_color  = sanitize_hex_color($_POST['pm_bulk_color']);

        if (!empty($selected_cats)) {
            $bulk_query = new WP_Query(array('post_type' => 'post', 'posts_per_page' => -1, 'post_status' => 'any', 'category__in' => $selected_cats));
            $bulk_counter = 0;
            if ($bulk_query->have_posts()) {
                while ($bulk_query->have_posts()) {
                    $bulk_query->the_post();
                    $pid = get_the_ID();
                    if(!empty($target_icon)) { update_post_meta($pid, '_wm_ozel_ikon', $target_icon); }
                    if(!empty($target_color)) { update_post_meta($pid, '_wm_rota_renk', $target_color); }
                    $bulk_counter++;
                }
                wp_reset_postdata();
            }
            echo '<div class="updated"><p>🎯 <strong>Kategori Eşitlemesi Başarılı:</strong> Toplam <strong>' . $bulk_counter . '</strong> yazı güncellendi.</p></div>';
        }
    }

    if ( isset($_POST['pm_apply_to_all_posts_check']) && $_POST['pm_apply_to_all_posts_check'] === '1' ) {
        $guncel_varsayilan_pin = isset($_POST['pm_varsayilan_pin']) ? sanitize_text_field($_POST['pm_varsayilan_pin']) : 'leaflet-default';
        $guncel_default_color  = isset($_POST['pm_default_line_color']) ? sanitize_hex_color($_POST['pm_default_line_color']) : '#ff3388';

        $tum_yazilar = get_posts(array('post_type' => 'post', 'posts_per_page' => -1, 'post_status' => 'any'));
        $sync_sayac = 0;
        foreach ($tum_yazilar as $yazi) {
            update_post_meta($yazi->ID, '_wm_ozel_ikon', $guncel_varsayilan_pin);
            update_post_meta($yazi->ID, '_wm_rota_renk', $guncel_default_color);
            $sync_sayac++;
        }
        echo '<div class="updated"><p>⚙️ <strong>Toplu Senkronizasyon Başarılı:</strong> Tüm <strong>' . $sync_sayac . '</strong> geçmiş yazıya küresel ayarlar uygulandı.</p></div>';
    }

    if ( isset( $_POST['pm_download_json'] ) && check_admin_referer( 'pm_download_nonce_action', 'pm_download_nonce' ) ) { pm_generate_json_file(); }

    $secili_altlik = get_option( 'pm_harita_altlik', 'osm' );
    $varsayilan_pin = get_option( 'pm_varsayilan_pin', 'leaflet-default' );
    $default_color = get_option( 'pm_default_line_color', '#ff3388' );
    $secondary_color = get_option( 'pm_secondary_line_color', '#555555' );
    
    $popup_waymark = get_option('pm_popup_show_waymark', '1');
    $popup_blog = get_option('pm_popup_show_blog', '1');
    
    $mevcut_pinler = pm_get_local_pin_images();
    $active_features = get_option('pm_active_features', array('osrm_routing'=>'1','line_arrows'=>'1','popup_edit'=>'1','subcat_fade'=>'1','fullscreen'=>'1'));
    $all_wp_categories = get_categories(array('hide_empty' => 0));
    ?>
    <div class="wrap">
        <h1>PostMap Yönetim Paneli (Sürüm 9.6)</h1>
        
        <form method="post" action="">
            <?php settings_fields( 'pm_harita_ayarlar_grubu' ); ?>
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="option_page" value="pm_harita_ayarlar_grubu" />
            
            <h2 style="margin-top:25px;">Harita Modülleri Yönetim Merkezi</h2>
            <table class="wp-list-table widefat fixed striping" style="max-width: 850px; background: #fff;">
                <thead>
                    <tr>
                        <th style="padding:12px; font-weight:bold; width:220px;">Özellik</th>
                        <th style="padding:12px; font-weight:bold;">Açıklama</th>
                        <th style="padding:12px; font-weight:bold; width:100px; text-align:center;">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>OSRM Yol Takip Motoru</strong></td>
                        <td>Yazı haritasında noktaları yollara oturtur ve sürükleyerek anlık revize sunar.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[osrm_routing]" value="1" <?php checked(isset($active_features['osrm_routing']) && $active_features['osrm_routing'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Rota Yön Okları</strong></td>
                        <td>Ön yüz haritasındaki rotalarda ok yön çizgileri çizer.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[line_arrows]" value="1" <?php checked(isset($active_features['line_arrows']) && $active_features['line_arrows'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Aynı Alt Kategori Rotaları</strong></td>
                        <td>Pine tıklandığında, aynı seriye ait diğer yolları haritada ikincil renkle çizer.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[subcat_fade]" value="1" <?php checked(isset($active_features['subcat_fade']) && $active_features['subcat_fade'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Popup Düzenleme İkonu (✏️)</strong></td>
                        <td>Giriş yapmış adminlere popup içerisinde sağ üstte hızlı yazı düzenleme linki sunar.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[popup_edit]" value="1" <?php checked(isset($active_features['popup_edit']) && $active_features['popup_edit'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Tam Ekran Modu (Fullscreen)</strong></td>
                        <td>Haritalarda sol üst köşeye tam ekran genişleme simgesi ekler.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[fullscreen]" value="1" <?php checked(isset($active_features['fullscreen']) && $active_features['fullscreen'] === '1'); ?> /></td>
                    </tr>
                </tbody>
            </table>

            <h2>Ön Yüz Popup Link Tercihleri (Popup Link Yönetimi)</h2>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Popup Link Yönetimi:</th>
                    <td>
                        <label><input type="checkbox" name="pm_popup_show_waymark" value="1" <?php checked($popup_waymark, '1'); ?> /> Waymark Harita Linkini Göster</label><br/><br/>
                        <label><input type="checkbox" name="pm_popup_show_blog" value="1" <?php checked($popup_blog, '1'); ?> /> Blog Yazısı Linkini Göster</label>
                        <p class="description">İkisi birden seçilirse Waymark linki sol üstte route.png simgesiyle açılır, başlık ise blog yazısına gider.</p>
                    </td>
                </tr>
            </table>

            <h2>Genel Harita Stil Ayarları</h2>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Varsayılan Harita Altlığı:</th>
                    <td>
                        <label><input type="radio" name="pm_harita_altlik" value="osm" <?php checked( $secili_altlik, 'osm' ); ?> /> OpenStreetMap</label>&nbsp;&nbsp;
                        <label><input type="radio" name="pm_harita_altlik" value="topo" <?php checked( $secili_altlik, 'topo' ); ?> /> OpenTopoMap</label>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row">Varsayılan Aktif Rota Rengi:</th>
                    <td><input type="color" name="pm_default_line_color" value="<?php echo esc_attr($default_color); ?>" /></td>
                </tr>
                <tr valign="top">
                    <th scope="row">Aynı Alt Kategori İkincil Rota Rengi:</th>
                    <td><input type="color" name="pm_secondary_line_color" value="<?php echo esc_attr($secondary_color); ?>" /></td>
                </tr>
                <tr valign="top">
                    <th scope="row">Varsayılan İkon Seçimi:</th>
                    <td>
                        <!-- DÜZELTME: Dropdown değişince yanındaki görsel anında güncellenir -->
                        <select name="pm_varsayilan_pin" id="pm_varsayilan_pin" style="vertical-align: middle;">
                            <?php foreach($mevcut_pinler as $k => $p): ?>
                                <option value="<?php echo esc_attr($k); ?>" <?php selected($varsayilan_pin, $k); ?>><?php echo esc_html($p['name']); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <img id="pm_varsayilan_pin_preview" src="" style="max-height: 35px; margin-left: 10px; vertical-align: middle; display: none;" />
                    </td>
                </tr>
            </table>

            <div style="background: #fdfdfd; padding: 15px; border: 1px solid #ccd0d4; margin-top: 20px; max-width: 850px; display: flex; align-items: center; gap: 20px;">
                <input type="submit" name="submit" id="submit" class="button button-primary" value="Ayarları Kaydet" />
                <label style="font-weight: 600; color: #d63638; background: #fff5f5; padding: 8px 12px; border: 1px dashed #d63638; cursor: pointer;">
                    <input type="checkbox" name="pm_apply_to_all_posts_check" value="1" /> 
                    ⚠️ Yapılan bu değişiklikleri geçmişe dönük TÜM yazı sayfalarına uygula (Toplu Eşitleme)
                </label>
            </div>
        </form>

        <hr/>
        
        <h2>Kategori Bazlı Toplu İkon ve Rota Değiştirici</h2>
        <p class="description">Ctrl / Cmd tuşuna basılı tutarak çoklu seçim yapabilirsin.</p>
        <div style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; max-width: 850px; border-radius: 5px; margin-top: 15px;">
            <form method="post" action="">
                <?php wp_nonce_field('pm_bulk_cat_nonce_action', 'pm_bulk_cat_nonce'); ?>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Kategorileri Seçin:</label>
                        <select name="pm_bulk_categories[]" multiple style="width: 100%; height: 150px; font-family: monospace;">
                            <?php foreach($all_wp_categories as $wp_cat): ?>
                                <option value="<?php echo $wp_cat->term_id; ?>"><?php echo esc_html($wp_cat->name) . ' (' . $wp_cat->count . ')'; ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Uygulanacak Yeni İkon:</label>
                            <!-- DÜZELTME: Dropdown değişince yanındaki görsel anında güncellenir -->
                            <select name="pm_bulk_icon" id="pm_bulk_icon" style="width: 100%; vertical-align: middle;">
                                <option value="">-- Değiştirme (Eski Hali Kalsın) --</option>
                                <?php foreach($mevcut_pinler as $k => $p): ?>
                                    <option value="<?php echo esc_attr($k); ?>"><?php echo esc_html($p['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <img id="pm_bulk_icon_preview" src="" style="max-height: 35px; margin-top: 10px; vertical-align: middle; display: none;" />
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Uygulanacak Yeni Rota Rengi:</label>
                            <input type="color" name="pm_bulk_color" value="<?php echo esc_attr($default_color); ?>" style="width: 60px; height: 35px;" />
                        </div>
                        <div style="margin-top: auto;">
                            <input type="submit" name="pm_bulk_cat_submit" class="button button-secondary" value="Seçili Kategorileri Toplu Güncelle" onclick="return confirm('Seçili kategorilerdeki veriler güncellenecektir. Emin misiniz?');" />
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <script type="text/javascript">
        document.addEventListener("DOMContentLoaded", function() {
            var pinData = <?php echo json_encode($mevcut_pinler); ?>;
            
            // 1. Global Varsayılan İkon Seçimi Önizleme Tetikleyicisi
            var defaultSelect = document.getElementById('pm_varsayilan_pin');
            var defaultPreview = document.getElementById('pm_varsayilan_pin_preview');
            if (defaultSelect && defaultPreview) {
                function updateDefaultPreview() {
                    var val = defaultSelect.value;
                    if (pinData[val]) {
                        defaultPreview.src = pinData[val].url;
                        defaultPreview.style.display = 'inline-block';
                    } else {
                        defaultPreview.style.display = 'none';
                    }
                }
                defaultSelect.addEventListener('change', updateDefaultPreview);
                updateDefaultPreview();
            }
            
            // 2. Kategori Toplu İkon Seçimi Önizleme Tetikleyicisi
            var bulkSelect = document.getElementById('pm_bulk_icon');
            var bulkPreview = document.getElementById('pm_bulk_icon_preview');
            if (bulkSelect && bulkPreview) {
                function updateBulkPreview() {
                    var val = bulkSelect.value;
                    if (pinData[val]) {
                        bulkPreview.src = pinData[val].url;
                        bulkPreview.style.display = 'inline-block';
                    } else {
                        bulkPreview.style.display = 'none';
                    }
                }
                bulkSelect.addEventListener('change', updateBulkPreview);
                updateBulkPreview();
            }
        });
        </script>

        <hr/>
        <h2>Verileri Dışa Aktar</h2>
        <form method="post" action="">
            <?php wp_nonce_field( 'pm_download_nonce_action', 'pm_download_nonce' ); ?>
            <input type="submit" name="pm_download_json" class="button button-primary" value="veri.json Dosyasını İndir">
        </form>
    </div>
    <?php
}

function pm_get_map_tile_details() {
    if ( get_option( 'pm_harita_altlik', 'topo' ) === 'topo' ) {
        return array('url' => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'attr' => '© OpenTopoMap');
    }
    return array('url' => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'attr' => '© OpenStreetMap');
}

// =========================================================================
// 4. SCRIPT VE ASSET ENJEKSİYONLARI (ADMIN VE "İLGİLİ ROTA" BUTONU)
// =========================================================================
add_action( 'admin_enqueue_scripts', 'pm_admin_assets' );
function pm_admin_assets( $hook ) {
    if ( $hook == 'post.php' || $hook == 'post-new.php' ) {
        wp_enqueue_style( 'leaflet-admin-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', array(), '1.9.4' );
        wp_enqueue_script( 'leaflet-admin-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', array(), '1.9.4', true );
        wp_enqueue_script( 'leaflet-decorator-js', 'https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.min.js', array('leaflet-admin-js'), '1.6.0', true );
        
        wp_enqueue_style( 'leaflet-routing-css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.css', array(), '3.2.12' );
        wp_enqueue_script( 'leaflet-routing-js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.js', array('leaflet-admin-js'), '3.2.12', true );
        
        if (pm_is_feature_active('fullscreen')) {
            wp_enqueue_style( 'leaflet-fullscreen-css', 'https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css', array(), '1.0.1' );
            wp_enqueue_script( 'leaflet-fullscreen-js', 'https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/Leaflet.fullscreen.min.js', array('leaflet-admin-js'), '1.0.1', true );
        }
    }
}

// "İLGİLİ ROTA" BUTONUNU EKRAN TERCİHLERİ / YARDIM METASININ YANINA ENJEKTE EDEN MOTOR
add_action('admin_footer', 'pm_inject_ilgili_rota_button');
function pm_inject_ilgili_rota_button() {
    $screen = get_current_screen();
    if ($screen && $screen->base === 'post' && $screen->post_type === 'post') {
        ?>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            var $metaLinks = $('#screen-meta-links');
            if ($metaLinks.length) {
                var $button = $('<div id="pm-ilgili-rota-btn-wrap" style="float: right; margin-right: 10px;">' +
                    '<button type="button" class="button button-secondary" id="pm-goto-rota-btn" style="height: 28px; line-height: 26px; font-weight: 600; background: #2271b1; color: #fff; border-color: #135e96; text-shadow: none;">' +
                    'İlgili Rota ↓' +
                    '</button>' +
                    '</div>');
                $metaLinks.append($button);
                
                $('#pm-goto-rota-btn').on('click', function(e) {
                    e.preventDefault();
                    var $target = $('#pm_konum_meta');
                    if ($target.length) {
                        $('html, body').animate({
                            scrollTop: $target.offset().top - 50
                        }, 800);
                    }
                });
            }
        });
        </script>
        <?php
    }
}

// Waymark Arama AJAX (Metabox autocomplete için)
add_action( 'wp_ajax_pm_search_waymark_maps', 'pm_search_waymark_maps_callback' );
function pm_search_waymark_maps_callback() {
    $search_term = isset($_GET['q']) ? sanitize_text_field($_GET['q']) : '';
    $query = new WP_Query(array('post_type' => 'waymark_map', 'post_status' => 'publish', 'posts_per_page' => 15, 's' => $search_term));
    $results = array();
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post(); $map_id = get_the_ID(); $geojson_url = '';
            if(!empty(get_post_meta($map_id, 'waymark_data', true))) { $geojson_url = wp_get_attachment_url(get_post_meta($map_id, 'waymark_geojson_file_id', true)); }
            $results[] = array('id' => $map_id, 'title' => get_the_title(), 'geojson' => $geojson_url);
        }
        wp_reset_postdata();
    }
    wp_send_json_success($results);
}


// =========================================================================
// 5. METABOX VE YAZI İÇİ HARİTA YÖNETİMİ
// =========================================================================
add_action( 'add_meta_boxes', 'pm_konum_metabox_ekle' );
function pm_konum_metabox_ekle() {
    add_meta_box( 'pm_konum_meta', 'Yazı Konum ve Rota Ayarları (PostMap)', 'pm_konum_metabox_html', 'post', 'normal', 'high' );
}

function pm_konum_metabox_html( $post ) {
    $konum = get_post_meta( $post->ID, '_wm_koordinat', true );
    
    $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
    $ikon_secimi = get_post_meta( $post->ID, '_wm_ozel_ikon', true );
    if ( empty($ikon_secimi) ) { $ikon_secimi = $varsayilan_ayar_pin; }

    $selected_waymark = get_post_meta( $post->ID, '_wm_waymark_id', true );
    $waymark_title = $selected_waymark ? get_the_title($selected_waymark) : '';

    $tahmini_rota_data = get_post_meta( $post->ID, '_wm_tahmini_rota', true );
    $saved_color = get_post_meta( $post->ID, '_wm_rota_renk', true ) ? get_post_meta( $post->ID, '_wm_rota_renk', true ) : get_option('pm_default_line_color', '#ff3388');
    
    $last_end_coords = pm_get_last_route_end_coords();
    $tile_info = pm_get_map_tile_details();
    $mevcut_pinler = pm_get_local_pin_images();
    
    wp_nonce_field( 'pm_konum_kaydet_nonce', 'pm_konum_nonce' );
    ?>
    <div style="margin-bottom: 15px; display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px;">Başlangıç Pini Koordinatları:</label>
            <input type="text" id="wm_koordinat_input" name="wm_koordinat" value="<?php echo esc_attr($konum); ?>" placeholder="Örn: 41.2112, 27.7724" style="width:100%; font-family:monospace; height: 32px;" />
        </div>
        <div style="flex: 1; min-width: 180px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px;">Çizgi Rengi Seçimi:</label>
            <input type="color" id="pm_line_color_picker" name="wm_rota_renk" value="<?php echo esc_attr($saved_color); ?>" style="width:100%; height:32px;" />
        </div>
        <input type="hidden" id="wm_tahmini_rota_input" name="wm_tahmini_rota" value="<?php echo esc_attr($tahmini_rota_data); ?>" />
    </div>

    <!-- GERİ GETİRİLEN WAYMARK AUTOCOMPLETE ALANI -->
    <div style="margin-bottom: 15px; background: #f9f9f9; padding: 15px; border: 1px solid #dfdfdf; border-radius: 4px;">
        <label style="display:block; font-weight:bold; margin-bottom:5px;">Alternatif: Hazır Waymark Rotası Bağlayın:</label>
        <div style="display:flex; gap: 10px; align-items: center;">
            <div style="position: relative; flex-grow: 1;">
                <input type="text" id="wm_waymark_autocomplete" autocomplete="off" placeholder="Waymark Harita adı yazın..." value="<?php echo esc_attr($waymark_title); ?>" style="width:100%; height: 32px;" />
                <input type="hidden" id="wm_waymark_id_hidden" name="wm_waymark_id" value="<?php echo esc_attr($selected_waymark); ?>" />
                <ul id="wm_autocomplete_results" style="position: absolute; width: 100%; background: #fff; border: 1px solid #ccc; list-style: none; max-height: 200px; overflow-y: auto; z-index: 999; display: none; margin:0; padding:0;"></ul>
            </div>
            <button type="button" id="wm_insert_shortcode_btn" class="button button-secondary" style="height: 32px;" <?php echo !$selected_waymark ? 'disabled' : ''; ?>>Kısa Kodu Yazıya Ekle</button>
        </div>
    </div>

    <div id="wm_admin_harita" style="height: 420px; width: 100%; border: 1px solid #ccc; border-radius:4px; margin-bottom:20px;"></div>

    <div style="margin-bottom: 15px;">
        <label style="display:block; font-weight:bold; margin-bottom:8px;">Yazıya Özel İkon Seçin:</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; background: #fff; padding: 12px; border: 1px solid #ccc;">
            <?php foreach ( $mevcut_pinler as $key => $pin ): ?>
                <label style="cursor: pointer; display: flex; flex-direction: column; align-items: center; border: 2px solid <?php echo ($ikon_secimi === $key) ? '#0073aa' : '#eee'; ?>; padding: 10px; width: 110px; text-align: center; background: <?php echo ($ikon_secimi === $key) ? '#f0f6fa' : '#fff'; ?>;" class="pm-pin-label-box">
                    <input type="radio" name="wm_ozel_ikon" value="<?php echo esc_attr($key); ?>" data-url="<?php echo esc_url($pin['url']); ?>" <?php checked($ikon_secimi, $key); ?> onchange="updateAdminMarkerIcon(this);" />
                    <img src="<?php echo esc_url( $pin['url'] ); ?>" style="max-height: 38px; max-width: 38px; object-fit: contain; margin-top:5px;" />
                    <span style="font-size: 11px; margin-top:5px;"><?php echo esc_html( $pin['name'] ); ?></span>
                </label>
            <?php endforeach; ?>
        </div>
    </div>

    <style>
    .pm-map-controls { background: white; padding: 6px; border-radius: 6px; box-shadow: 0 1px 5px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 5px; }
    .pm-map-controls button { background: #f5f5f5; border: 1px solid #ccc; padding: 6px; font-size: 11px; font-weight: bold; cursor: pointer; border-radius: 4px; }
    .pm-mode-active { background: #2271b1 !important; color: white !important; }
    .leaflet-routing-container { display: none !important; }
    </style>

    <script>
    var globalAdminMarker = null;
    function updateAdminMarkerIcon(radioInput) {
        document.querySelectorAll('.pm-pin-label-box').forEach(el => { el.style.borderColor='#eee'; el.style.background='#fff'; });
        radioInput.parentElement.style.borderColor='#0073aa'; radioInput.parentElement.style.background='#f0f6fa';
        if (globalAdminMarker) {
            var iconUrl = radioInput.getAttribute('data-url');
            var newIcon = (radioInput.value === 'leaflet-default') ? new L.Icon.Default() : L.icon({ iconUrl: iconUrl, iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] });
            globalAdminMarker.setIcon(newIcon);
        }
    }

    document.addEventListener("DOMContentLoaded", function() {
        var coordInput = document.getElementById('wm_koordinat_input'),
            drawnRouteInput = document.getElementById('wm_tahmini_rota_input'),
            colorPicker = document.getElementById('pm_line_color_picker'),
            inputEl = document.getElementById('wm_waymark_autocomplete'), 
            hiddenEl = document.getElementById('wm_waymark_id_hidden'), 
            resultsEl = document.getElementById('wm_autocomplete_results'), 
            shortcodeBtn = document.getElementById('wm_insert_shortcode_btn'),
            debounceTimer;
            
        if (typeof L === "undefined") return;

        var defaultLat = <?php echo $last_end_coords[0]; ?>, defaultLng = <?php echo $last_end_coords[1]; ?>, hasInitialCoord = false;
        if(coordInput.value) { var parts = coordInput.value.split(','); if(parts.length === 2) { defaultLat = parseFloat(parts[0].trim()); defaultLng = parseFloat(parts[1].trim()); hasInitialCoord = true; } }
        
        var mapOptions = { zoomControl: false };
        <?php if(pm_is_feature_active('fullscreen')): ?> mapOptions.fullscreenControl = true; <?php endif; ?>
        var map = L.map('wm_admin_harita', mapOptions).setView([defaultLat, defaultLng], 11);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer('<?php echo $tile_info["url"]; ?>', { maxZoom: 18, attribution: '<?php echo esc_js($tile_info["attr"]); ?>' }).addTo(map);

        var currentSelectedRadio = document.querySelector('input[name="wm_ozel_ikon"]:checked');
        var initialIcon = (currentSelectedRadio && currentSelectedRadio.value !== 'leaflet-default') ? L.icon({ iconUrl: currentSelectedRadio.getAttribute('data-url'), iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] }) : new L.Icon.Default();

        var currentMode = 'manual'; 
        var routePoints = []; 
        if(drawnRouteInput.value) { try { routePoints = JSON.parse(drawnRouteInput.value); } catch(e) { routePoints = []; } }
        
        var adminPolyline = L.polyline(routePoints, {color: colorPicker.value, weight: 4}).addTo(map);
        var routingControl = null;

        if(hasInitialCoord) {
            globalAdminMarker = L.marker([defaultLat, defaultLng], {draggable: true, icon: initialIcon}).addTo(map);
            globalAdminMarker.on('dragend', function() {
                var newPos = globalAdminMarker.getLatLng(); coordInput.value = newPos.lat.toFixed(14) + ", " + newPos.lng.toFixed(14);
                if(routePoints.length > 0) { routePoints[0] = [newPos.lat, newPos.lng]; adminPolyline.setLatLngs(routePoints); drawnRouteInput.value = JSON.stringify(routePoints); }
            });
        }

        var CustomControls = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                var container = L.DomUtil.create('div', 'pm-map-controls');
                this._btnManual = L.DomUtil.create('button', 'pm-mode-active', container); this._btnManual.innerHTML = 'Serbest Çizim';
                this._btnRoute  = L.DomUtil.create('button', '', container); this._btnRoute.innerHTML = 'Yol Takip Et';
                this._btnReset  = L.DomUtil.create('button', '', container); this._btnReset.innerHTML = 'Temizle';
                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });
        var mapControls = new CustomControls(); map.addControl(mapControls);

        function switchMode(mode) {
            currentMode = mode;
            if(mode === 'manual') {
                mapControls._btnManual.classList.add('pm-mode-active'); mapControls._btnRoute.classList.remove('pm-mode-active');
                if(routingControl) { map.removeControl(routingControl); routingControl = null; }
            } else {
                mapControls._btnRoute.classList.add('pm-mode-active'); mapControls._btnManual.classList.remove('pm-mode-active');
                initRoutingEngine();
            }
        }

        L.DomEvent.on(mapControls._btnManual, 'click', function(e) { L.DomEvent.preventDefault(e); switchMode('manual'); });
        L.DomEvent.on(mapControls._btnRoute, 'click', function(e) { L.DomEvent.preventDefault(e); switchMode('routing'); });

        function initRoutingEngine() {
            if(routingControl) { map.removeControl(routingControl); }
            var wps = [];
            routePoints.forEach(function(pt) { wps.push(L.latLng(pt[0], pt[1])); });

            routingControl = L.Routing.control({
                waypoints: wps,
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving' }),
                lineOptions: { styles: [{ color: colorPicker.value, opacity: 0.8, weight: 4 }] },
                fitSelectedRoutes: false,
                routeWhileDragging: true
            }).addTo(map);

            routingControl.on('routesfound', function(e) {
                var routes = e.routes;
                if(routes && routes[0]) {
                    routePoints = routes[0].coordinates.map(function(c) { return [c.lat, c.lng]; });
                    adminPolyline.setLatLngs(routePoints);
                    drawnRouteInput.value = JSON.stringify(routePoints);
                }
            });
        }

        map.on('click', function(e) {
            var lat = e.latlng.lat; var lng = e.latlng.lng;
            if (!globalAdminMarker) {
                coordInput.value = lat.toFixed(14) + ", " + lng.toFixed(14);
                globalAdminMarker = L.marker([lat, lng], {draggable: true, icon: initialIcon}).addTo(map);
                routePoints = [[lat, lng]];
                adminPolyline.setLatLngs(routePoints);
                drawnRouteInput.value = JSON.stringify(routePoints);
            } else {
                if(currentMode === 'manual') {
                    routePoints.push([lat, lng]);
                    adminPolyline.setLatLngs(routePoints);
                    drawnRouteInput.value = JSON.stringify(routePoints);
                } else if(currentMode === 'routing' && routingControl) {
                    var currentWps = routingControl.getWaypoints().filter(w => w.latLng);
                    currentWps.push(L.latLng(lat, lng));
                    routingControl.setWaypoints(currentWps);
                }
            }
        });

        L.DomEvent.on(mapControls._btnReset, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            if(confirm('Temizlensin mi?')) {
                routePoints = []; adminPolyline.setLatLngs([]); drawnRouteInput.value = '';
                if(globalAdminMarker) { map.removeLayer(globalAdminMarker); globalAdminMarker = null; }
                if(routingControl) { routingControl.setWaypoints([]); }
                coordInput.value = '';
            }
        });

        // GERİ GETİRİLEN WAYMARK AUTOCOMPLETE ETKİLEŞİM TETİKLEYİCİSİ
        if (inputEl) {
            inputEl.addEventListener('input', function() {
                var value = this.value.trim(); clearTimeout(debounceTimer); if (value.length < 2) { resultsEl.style.display = 'none'; return; }
                debounceTimer = setTimeout(function() {
                    fetch(ajaxurl + '?action=pm_search_waymark_maps&q=' + encodeURIComponent(value))
                        .then(res => res.json())
                        .then(res => {
                            if (res.success && res.data.length > 0) {
                                resultsEl.innerHTML = ''; resultsEl.style.display = 'block';
                                res.data.forEach(function(item) {
                                    var li = document.createElement('li'); li.textContent = item.title; li.style.padding = '8px 12px'; li.style.cursor = 'pointer';
                                    li.addEventListener('mouseover', function() { this.style.background = '#f0f0f0'; });
                                    li.addEventListener('mouseout', function() { this.style.background = '#fff'; });
                                    li.addEventListener('click', function() {
                                        inputEl.value = item.title; hiddenEl.value = item.id; resultsEl.style.display = 'none'; shortcodeBtn.removeAttribute('disabled');
                                        if(item.geojson) {
                                            fetch(item.geojson).then(r => r.json()).then(geo => {
                                                if (geo.features && geo.features.length > 0) {
                                                    var geom = geo.features[0].geometry; 
                                                    var coords = (geom.type === "LineString") ? geom.coordinates[0] : (geom.type === "Point" ? geom.coordinates : null);
                                                    if (coords) { 
                                                        var lat = coords[1].toFixed(14), lng = coords[0].toFixed(14); coordInput.value = lat + ", " + lng; var nLL = new L.LatLng(lat, lng); 
                                                        if(!globalAdminMarker) { globalAdminMarker = L.marker(nLL, {draggable: true, icon: initialIcon}).addTo(map); } else { globalAdminMarker.setLatLng(nLL); }
                                                        map.panTo(nLL); routePoints = [[parseFloat(lat), parseFloat(lng)]];
                                                        adminPolyline.setLatLngs(routePoints);
                                                        drawnRouteInput.value = JSON.stringify(routePoints);
                                                    }
                                                }
                                            });
                                        }
                                    });
                                    resultsEl.appendChild(li);
                                });
                            } else {
                                resultsEl.style.display = 'none';
                            }
                        });
                }, 300);
            });

            shortcodeBtn.addEventListener('click', function(e) {
                e.preventDefault(); var mapId = hiddenEl.value; if(!mapId) return; var shortcode = '[waymark_map id="' + mapId + '"]';
                if (typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor && !tinyMCE.activeEditor.isHidden()) { tinyMCE.activeEditor.setContent(tinyMCE.activeEditor.getContent() + "\n" + shortcode); }
                else { var wpTextarea = document.getElementById('content') || document.querySelector('.wp-editor-area'); if (wpTextarea) { wpTextarea.value += "\n" + shortcode; wpTextarea.dispatchEvent(new Event('input', { bubbles: true })); } }
            });
        }
    });
    </script>
    <?php
}

add_action( 'save_post', 'pm_konum_meta_kaydet' );
function pm_konum_meta_kaydet( $post_id ) {
    if ( ! isset( $_POST['pm_konum_nonce'] ) || ! wp_verify_nonce( $_POST['pm_konum_nonce'], 'pm_konum_kaydet_nonce' ) ) return;
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
    if ( isset( $_POST['wm_koordinat'] ) ) update_post_meta( $post_id, '_wm_koordinat', sanitize_text_field( $_POST['wm_koordinat'] ) );
    if ( isset( $_POST['wm_ozel_ikon'] ) ) update_post_meta( $post_id, '_wm_ozel_ikon', sanitize_text_field( $_POST['wm_ozel_ikon'] ) );
    if ( isset( $_POST['wm_waymark_id'] ) ) update_post_meta( $post_id, '_wm_waymark_id', sanitize_text_field( $_POST['wm_waymark_id'] ) );
    if ( isset( $_POST['wm_tahmini_rota'] ) ) update_post_meta( $post_id, '_wm_tahmini_rota', $_POST['wm_tahmini_rota'] );
    if ( isset( $_POST['wm_rota_renk'] ) ) update_post_meta( $post_id, '_wm_rota_renk', sanitize_hex_color($_POST['wm_rota_renk']) );
}

// =========================================================================
// 6. FRONT-END SHORTCODE [yazi-haritasi] (SOL ÜSTTE ROTA, SAĞ ÜSTTE DÜZENLEME)
// =========================================================================
add_shortcode( 'yazi-haritasi', 'pm_frontend_harita_shortcode' );
function pm_frontend_harita_shortcode() {
    wp_enqueue_style( 'leaflet-fe-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', array(), '1.9.4' );
    wp_enqueue_script( 'leaflet-fe-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', array(), '1.9.4', true );
    wp_enqueue_script( 'leaflet-fe-decorator', 'https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.min.js', array('leaflet-fe-js'), '1.6.0', true );
    
    if (pm_is_feature_active('fullscreen')) {
        wp_enqueue_style( 'leaflet-fe-fullscreen-css', 'https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css', array(), '1.0.1' );
        wp_enqueue_script( 'leaflet-fe-fullscreen-js', 'https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/Leaflet.fullscreen.min.js', array('leaflet-fe-js'), '1.0.1', true );
    }

    $tile_info = pm_get_map_tile_details(); $all_pins = pm_get_local_pin_images();
    $query = new WP_Query(array('post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1));
    $markers_js_data = array();

    $show_waymark_opt = get_option('pm_popup_show_waymark', '1');
    $show_blog_opt    = get_option('pm_popup_show_blog', '1');
    $global_secondary_color = get_option('pm_secondary_line_color', '#555555');
    $is_admin_logged_in = current_user_can('edit_posts') && pm_is_feature_active('popup_edit');

    if ( $query->have_posts() ) {
        while ( $query->have_posts() ) {
            $query->the_post();
            $post_id       = get_the_ID();
            $koordinat_raw = get_post_meta( $post_id, '_wm_koordinat', true );
            $ikon_secimi   = get_post_meta( $post_id, '_wm_ozel_ikon', true );
            $waymark_id    = get_post_meta( $post_id, '_wm_waymark_id', true );
            $tahmini_rota  = get_post_meta( $post_id, '_wm_tahmini_rota', true );
            $rota_renk     = get_post_meta( $post_id, '_wm_rota_renk', true ) ? get_post_meta( $post_id, '_wm_rota_renk', true ) : get_option('pm_default_line_color', '#ff3388');

            if ( ! $koordinat_raw ) continue;
            $parts = explode( ',', $koordinat_raw ); if ( count( $parts ) !== 2 ) continue;
            $gorsel = get_the_post_thumbnail_url( $post_id, 'medium' ) ? get_the_post_thumbnail_url( $post_id, 'medium' ) : '';
            
            $waymark_url = $waymark_id ? get_permalink($waymark_id) : '';
            $blog_url    = get_permalink();
            $title       = get_the_title();

            // POPUP LİNK KRİTER MOTORU (SİLİSİZ LINK MATRİSİ VE SIMGE YERLEŞİMİ)
            $popup_html = '<div class="pm-popup-card" style="position: relative; padding: 10px; padding-top: 25px; border: 1px solid #eee; border-radius: 5px; background: #fafafa; box-shadow: 0 1px 3px rgba(0,0,0,0.06); width: 230px;">';
            
            // ÜST EYLEM ALANI (SOL ÜST ROTA / SAĞ ÜST DÜZENLEME)
            $popup_html .= '<div class="pm-popup-top-bar" style="position: absolute; top: 4px; left: 5px; right: 5px; display: flex; justify-content: space-between; align-items: center; pointer-events: auto;">';
            
            // Sol Üst Köşe (YALNIZCA her iki link de seçiliyse route.png ile Waymark haritası)
            $popup_html .= '<div class="pm-popup-top-left" style="height: 20px;">';
            if ($show_waymark_opt === '1' && $show_blog_opt === '1' && !empty($waymark_url)) {
                $popup_html .= '<a href="'.esc_url($waymark_url).'" target="_blank" title="Waymark Rota Haritası" style="display: block;"><img src="'.plugin_dir_url(__FILE__).'data/sys/route.png" style="width: 18px; height: 18px; display: block; border: none;" onerror="this.style.display=\'none\';"/></a>';
            }
            $popup_html .= '</div>';
            
            // Sağ Üst Köşe (Yetkili admin ise Düzenleme butonu ✏️)
            $popup_html .= '<div class="pm-popup-top-right" style="height: 20px;">';
            if ($is_admin_logged_in) {
                $popup_html .= '<a href="'.esc_url(get_edit_post_link($post_id)).'" target="_blank" style="text-decoration: none; font-size: 13px; display: block;" title="Yazıyı Düzenle">✏️</a>';
            }
            $popup_html .= '</div>';
            
            $popup_html .= '</div>'; // Üst Eylem Barı Sonu

            // Kapak resmi
            if ($gorsel) {
                $popup_html .= '<img src="'.esc_url($gorsel).'" style="width:100%; height:auto; border-radius: 3px; margin-bottom: 6px; display: block;" />';
            }

            // Başlık Senaryo Yönetim Mantığı
            $popup_html .= '<div class="pm-popup-title-area" style="margin-top: 4px;">';
            if ($show_waymark_opt === '1' && $show_blog_opt === '1') {
                // Senaryo 3: Her ikisi de seçiliyse (Waymark yukarıda route.png ile verildi, Başlık blog yazısına gider)
                $popup_html .= '<strong style="font-size: 13px; line-height: 1.3;"><a href="'.esc_url($blog_url).'" target="_blank">'.esc_html($title).'</a></strong>';
            } elseif ($show_waymark_opt === '1' && $show_blog_opt !== '1') {
                // Senaryo 1: Sadece Waymark seçiliyse -> Başlık tıklanarak Waymark'a gider
                $popup_html .= '<strong style="font-size: 13px; line-height: 1.3;"><a href="'.esc_url($waymark_url).'" target="_blank">'.esc_html($title).'</a></strong>';
            } elseif ($show_waymark_opt !== '1' && $show_blog_opt === '1') {
                // Senaryo 2: Sadece blog yazısı seçiliyse -> Başlık tıklanarak Blog'a gider
                $popup_html .= '<strong style="font-size: 13px; line-height: 1.3;"><a href="'.esc_url($blog_url).'" target="_blank">'.esc_html($title).'</a></strong>';
            } else {
                // Senaryo 4: İkisi de kapalıysa -> Linksiz sade başlık metni
                $popup_html .= '<strong style="font-size: 13px; line-height: 1.3; color:#333;">'.esc_html($title).'</strong>';
            }
            $popup_html .= '</div>'; // Başlık Sonu
            
            $popup_html .= '</div>'; // Kart Sonu

            $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
            $final_pin_key = !empty($ikon_secimi) ? $ikon_secimi : $varsayilan_ayar_pin;
            $final_pin_url = isset($all_pins[$final_pin_key]) ? $all_pins[$final_pin_key]['url'] : $all_pins['leaflet-default']['url'];

            $markers_js_data[] = array(
                'id' => $post_id,
                'sub_cat' => pm_get_post_sub_category_id($post_id),
                'lat' => floatval(trim($parts[0])), 'lng' => floatval(trim($parts[1])),
                'title' => $title, 'popup' => $popup_html,
                'tahmini_rota' => is_array(json_decode($tahmini_rota, true)) ? json_decode($tahmini_rota, true) : array(),
                'line_color' => $rota_renk, 'is_default' => ($final_pin_key === 'leaflet-default'), 'icon_url' => $final_pin_url
            );
        }
        wp_reset_postdata();
    }

    ob_start();
    ?>
    <div id="wm_frontend_map" style="height: 550px; width: 100%; border: 1px solid #ddd; border-radius: 8px;"></div>
    
    <style>
    /* Popup dikey kaydırma çubukları tamamen kaldırıldı */
    .pm-popup-multi-container { overflow: hidden !important; display: flex; flex-direction: column; gap: 10px; width: 240px; }
    .leaflet-popup-content { margin: 8px 10px !important; }
    </style>

    <script>
    document.addEventListener("DOMContentLoaded", function() {
        if (typeof L === "undefined") return;
        var mapData = <?php echo json_encode( $markers_js_data ); ?>;
        
        var mapOptions = { zoomControl: false };
        <?php if(pm_is_feature_active('fullscreen')): ?> mapOptions.fullscreenControl = true; <?php endif; ?>
        var feMap = L.map('wm_frontend_map', mapOptions);
        
        L.control.zoom({ position: 'bottomright' }).addTo(feMap);
        L.tileLayer('<?php echo $tile_info["url"]; ?>', { maxZoom: 17, attribution: '<?php echo esc_js($tile_info["attr"]); ?>' }).addTo(feMap);
        
        var activeRoutesGroup = L.layerGroup().addTo(feMap);
        var boundsArray = [];

        var groupedMarkers = {};
        mapData.forEach(function(item) {
            var key = item.lat.toFixed(6) + "_" + item.lng.toFixed(6);
            if(!groupedMarkers[key]) { groupedMarkers[key] = []; }
            groupedMarkers[key].push(item);
        });

        Object.keys(groupedMarkers).forEach(function(key) {
            var itemsInLocation = groupedMarkers[key];
            var firstItem = itemsInLocation[0];
            boundsArray.push([firstItem.lat, firstItem.lng]);

            var opts = {}; 
            if (!firstItem.is_default) { 
                opts.icon = L.icon({ iconUrl: firstItem.icon_url, iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] }); 
            }
            
            // Çoklu pin varsa kartları dikey kaydırma çubuğu olmadan alt alta dizer
            var popupMasterHtml = '<div class="pm-popup-multi-container">';
            itemsInLocation.forEach(function(innerCard) {
                popupMasterHtml += innerCard.popup;
            });
            popupMasterHtml += '</div>';

            var marker = L.marker([firstItem.lat, firstItem.lng], opts).addTo(feMap).bindPopup(popupMasterHtml);

            marker.on('click', function() {
                activeRoutesGroup.clearLayers();
                var subcatFadeEnabled = <?php echo pm_is_feature_active('subcat_fade') ? 'true' : 'false'; ?>;
                var secondaryGlobalColor = '<?php echo esc_js($global_secondary_color); ?>';

                itemsInLocation.forEach(function(clickedLocationItem) {
                    mapData.forEach(function(innerItem) {
                        var isCurrentPost = (innerItem.id === clickedLocationItem.id);
                        var isSameSubcat = (subcatFadeEnabled && innerItem.sub_cat === clickedLocationItem.sub_cat);
                        
                        if (isCurrentPost || isSameSubcat) {
                            var calculatedColor = isCurrentPost ? innerItem.line_color : secondaryGlobalColor;
                            var calculatedWeight = isCurrentPost ? 5 : 3.5;
                            
                            if (innerItem.tahmini_rota && innerItem.tahmini_rota.length > 1) {
                                L.polyline(innerItem.tahmini_rota, { 
                                    color: calculatedColor, 
                                    weight: calculatedWeight, 
                                    opacity: isCurrentPost ? 1.0 : 0.6 
                                }).addTo(activeRoutesGroup);
                            }
                        }
                    });
                });
                feMap.panTo([firstItem.lat, firstItem.lng]);
            });
        });

        if (boundsArray.length > 0) { feMap.fitBounds(boundsArray, { padding: [50, 50] }); }
        else { feMap.setView([39.9334, 32.8597], 6); }
    });
    </script>
    <?php
    return ob_get_clean();
}

// =========================================================================
// 7. EXPORT ENGINE (DIŞA AKTARMA MOTORU)
// =========================================================================
function pm_generate_json_file() {
    $query = new WP_Query( array('post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1) ); $json_output = array();
    if ( $query->have_posts() ) {
        while ( $query->have_posts() ) {
            $query->the_post();
            $koordinat_raw = get_post_meta( get_the_ID(), '_wm_koordinat', true );
            $tahmini_rota  = get_post_meta( get_the_ID(), '_wm_tahmini_rota', true );
            $rota_renk     = get_post_meta( get_the_ID(), '_wm_rota_renk', true ) ? get_post_meta( get_the_ID(), '_wm_rota_renk', true ) : get_option('pm_default_line_color', '#ff3388');
            
            $enlem = 41.2112; $boylam = 27.7724;
            if ( $koordinat_raw ) { $parts = explode( ',', $koordinat_raw ); if(count($parts) === 2){ $enlem = floatval(trim($parts[0])); $boylam = floatval(trim($parts[1])); } }

            $json_output[] = array(
                'yazi_basligi'       => get_the_title(),
                'yazi_linki'         => get_permalink(),
                'koordinat'          => array( $enlem, $boylam ),
                'tahmini_el_rotasi'  => is_array(json_decode($tahmini_rota, true)) ? json_decode($tahmini_rota, true) : array(),
                'rota_rengi'         => $rota_renk,
                'kapak_resmi'        => get_the_post_thumbnail_url( get_the_ID(), 'full' ) ? get_the_post_thumbnail_url( get_the_ID(), 'full' ) : ''
            );
        }
        wp_reset_postdata();
    }
    header( 'Content-Type: application/json; charset=utf-8' ); header( 'Content-Disposition: attachment; filename="veri.json"' );
    echo json_encode( $json_output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ); exit;
}
