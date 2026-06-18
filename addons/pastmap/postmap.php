<?php
/**
 * Plugin Name: PostMap
 * Description: Yazılara konum ve Waymark rotaları ekler. Admin panelinde OSRM sürükleme desteği, modlar arası çizim koruması, akıllı son konum odaklanması, kategorilere göre toplu ikon/renk değiştirme ve ön yüz popup link yönetimi içerir. Sürüm 9.0.
 * Version: 9.0
 * Author: Ferdimen
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// 1. ANA MENÜ VE "F" IKONU ENJEKSİYONU
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
    $plugin_file = plugin_basename(__FILE__);
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
                    <td style="padding: 15px; vertical-align: middle;"><code>9.0</code></td>
                    <td style="padding: 15px; vertical-align: middle;">Eklenti aktif ve kararlı çalışıyor.</td>
                </tr>
            </tbody>
        </table>
    </div>
    <?php
}

// 2. DİNAMİK KLASÖR TARAMA MOTORU
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

// YAZININ EN SON ROTASININ BİTTİĞİ KOORDİNATI BULAN MOTOR
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
            return end($coords); // En son eklenen koordinat (bitiş noktası)
        }
    }
    return array(41.2112, 27.7724); // Varsayılan Tekirdağ/Çorlu merkez
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

// 3. AYARLAR VE YÖNETİM SAYFASI
add_action( 'admin_init', 'pm_eklenti_ayarlarini_kaydet' );
function pm_eklenti_ayarlarini_kaydet() {
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_harita_altlik' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_varsayilan_pin' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_default_line_color' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_secondary_line_color' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_default_show_arrows' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_active_features' );
    // Popup link kontrolörleri
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_popup_show_waymark', array('default' => '1') );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_popup_show_blog', array('default' => '1') );
}

function pm_postmap_admin_page() {
    // 1. KATEGORİ BAZLI TOPLU GÜNCELLEME MOTORU (YENİ)
    if ( isset($_POST['pm_bulk_cat_submit']) && check_admin_referer('pm_bulk_cat_nonce_action', 'pm_bulk_cat_nonce') ) {
        $selected_cats = isset($_POST['pm_bulk_categories']) ? array_map('intval', $_POST['pm_bulk_categories']) : array();
        $target_icon   = sanitize_text_field($_POST['pm_bulk_icon']);
        $target_color  = sanitize_hex_color($_POST['pm_bulk_color']);

        if (!empty($selected_cats)) {
            $bulk_query = new WP_Query(array(
                'post_type' => 'post',
                'posts_per_page' => -1,
                'post_status' => 'any',
                'category__in' => $selected_cats
            ));
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
            echo '<div class="updated"><p>🎯 <strong>Kategori Eşitlemesi Başarılı:</strong> Seçilen kategorilere ait toplam <strong>' . $bulk_counter . '</strong> yazının ikon ve renk ayarları topluca güncellendi.</p></div>';
        }
    }

    // 2. KÜRESEL TOPLU GEÇMİŞ EŞİTLEME MOTORU (SUBMIT CONTROL)
    if ( isset($_POST['pm_apply_to_all_posts_check']) && $_POST['pm_apply_to_all_posts_check'] === '1' ) {
        $guncel_varsayilan_pin = isset($_POST['pm_varsayilan_pin']) ? sanitize_text_field($_POST['pm_varsayilan_pin']) : 'leaflet-default';
        $guncel_default_color  = isset($_POST['pm_default_line_color']) ? sanitize_hex_color($_POST['pm_default_line_color']) : '#ff3388';
        $guncel_default_arrows = isset($_POST['pm_default_show_arrows']) ? '1' : '0';

        $tum_yazilar = get_posts(array('post_type' => 'post', 'posts_per_page' => -1, 'post_status' => 'any'));
        $sync_sayac = 0;
        foreach ($tum_yazilar as $yazi) {
            update_post_meta($yazi->ID, '_wm_ozel_ikon', $guncel_varsayilan_pin);
            update_post_meta($yazi->ID, '_wm_rota_renk', $guncel_default_color);
            update_post_meta($yazi->ID, '_wm_rota_ok_goster', $guncel_default_arrows);
            $sync_sayac++;
        }
        echo '<div class="updated"><p>⚙️ <strong>Toplu Senkronizasyon Başarılı:</strong> Küresel ayarlar veritabanındaki tüm <strong>' . $sync_sayac . '</strong> geçmiş yazıya kararlı olarak senkronize edildi!</p></div>';
    }

    if ( isset( $_POST['pm_download_json'] ) && check_admin_referer( 'pm_download_nonce_action', 'pm_download_nonce' ) ) { pm_generate_json_file(); }

    $secili_altlik = get_option( 'pm_harita_altlik', 'osm' );
    $varsayilan_pin = get_option( 'pm_varsayilan_pin', 'leaflet-default' );
    $default_color = get_option( 'pm_default_line_color', '#ff3388' );
    $secondary_color = get_option( 'pm_secondary_line_color', '#555555' );
    $default_arrows = get_option( 'pm_default_show_arrows', '1' );
    
    $popup_waymark = get_option('pm_popup_show_waymark', '1');
    $popup_blog = get_option('pm_popup_show_blog', '1');
    
    $mevcut_pinler = pm_get_local_pin_images();
    $active_features = get_option('pm_active_features', array('osrm_routing'=>'1','line_arrows'=>'1','popup_edit'=>'1','subcat_fade'=>'1','fullscreen'=>'1'));
    $all_wp_categories = get_categories(array('hide_empty' => 0));
    ?>
    <div class="wrap">
        <h1>PostMap Yönetim Paneli (Sürüm 9.0)</h1>
        
        <form method="post" action="">
            <?php settings_fields( 'pm_harita_ayarlar_grubu' ); ?>
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="option_page" value="pm_harita_ayarlar_grubu" />
            
            <h2 style="margin-top:25px;">Harita Özellikleri Yönetim Merkezi (Aç / Kapat)</h2>
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
                        <td>Yazı panelindeki haritada noktaları yollara oturtur ve sürükleyerek rota revizesi sunar.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[osrm_routing]" value="1" <?php checked(isset($active_features['osrm_routing']) && $active_features['osrm_routing'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Rota Yön Okları</strong></td>
                        <td>Ön yüz haritasındaki hatlarda hareket yönünü gösteren oklar çizer.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[line_arrows]" value="1" <?php checked(isset($active_features['line_arrows']) && $active_features['line_arrows'] === '1'); ?> /></td>
                    </tr>
                    <tr>
                        <td><strong>Aynı Alt Kategori Rotaları</strong></td>
                        <td>Pine tıklandığında, aynı seriye ait diğer yolları haritada arka planda ikincil renkle çizer.</td>
                        <td style="text-align:center;"><input type="checkbox" name="pm_active_features[subcat_fade]" value="1" <?php checked(isset($active_features['subcat_fade']) && $active_features['subcat_fade'] === '1'); ?> /></td>
                    </tr>
                </tbody>
            </table>

            <h2>Ön Yüz Popup Link Yönetimi Ayarları</h2>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Popup Link Tercihleri:</th>
                    <td>
                        <label><input type="checkbox" name="pm_popup_show_waymark" value="1" <?php checked($popup_waymark, '1'); ?> /> Waymark Harita Linkini Göster</label><br/><br/>
                        <label><input type="checkbox" name="pm_popup_show_blog" value="1" <?php checked($popup_blog, '1'); ?> /> Blog Yazısı Linkini Göster</label>
                        <p class="description">İkisi birden seçilirse Waymark linki sol köşede görsel jenerik ikonla, yazı linki ise başlıkta verilir.</p>
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
                        <select name="pm_varsayilan_pin">
                            <?php foreach($mevcut_pinler as $k => $p): ?>
                                <option value="<?php echo esc_attr($k); ?>" <?php selected($varsayilan_pin, $k); ?>><?php echo esc_html($p['name']); ?></option>
                            <?php endforeach; ?>
                        </select>
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
        <p class="description">Aşağıdan Ctrl / Cmd tuşuna basılı tutarak birden fazla kategori seçebilir ve o kategorilere ait tüm yazıların harita stilini tek hamlede güncelleyebilirsiniz.</p>
        <div style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; max-width: 850px; border-radius: 5px; margin-top: 15px;">
            <form method="post" action="">
                <?php wp_nonce_field('pm_bulk_cat_nonce_action', 'pm_bulk_cat_nonce'); ?>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Kategorileri Seçin (Çoklu Seçim):</label>
                        <select name="pm_bulk_categories[]" multiple style="width: 100%; height: 180px; font-family: monospace;">
                            <?php foreach($all_wp_categories as $wp_cat): ?>
                                <option value="<?php echo $wp_cat->term_id; ?>"><?php echo esc_html($wp_cat->name) . ' (' . $wp_cat->count . ')'; ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Uygulanacak Yeni İkon:</label>
                            <select name="pm_bulk_icon" style="width: 100%;">
                                <option value="">-- Değiştirme (Olduğu Gibi Bırak) --</option>
                                <?php foreach($mevcut_pinler as $k => $p): ?>
                                    <option value="<?php echo esc_attr($k); ?>"><?php echo esc_html($p['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Uygulanacak Yeni Rota Rengi:</label>
                            <input type="color" name="pm_bulk_color" value="#ff3388" style="width: 60px; height: 35px;" />
                        </div>
                        <div style="margin-top: auto;">
                            <input type="submit" name="pm_bulk_cat_submit" class="button button-secondary" value="Seçili Kategorileri Toplu Güncelle" onclick="return confirm('Seçili kategorilerdeki tüm harita verileri güncellenecektir. Emin misiniz?');" />
                        </div>
                    </div>
                </div>
            </form>
        </div>

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
    if ( get_option( 'pm_harita_altlik', 'osm' ) === 'topo' ) {
        return array('url' => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'attr' => '© OpenTopoMap');
    }
    return array('url' => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'attr' => '© OpenStreetMap');
}

// 4. ADMIN ASSETS
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

// 5. YAZI PANELİ METABOX (ADMIN HARİTASI VE ÇİZİM ALANI)
add_action( 'add_meta_boxes', 'pm_konum_metabox_ekle' );
function pm_konum_metabox_ekle() {
    add_meta_box( 'pm_konum_meta', 'Yazı Konum ve Rota Ayarları (PostMap)', 'pm_konum_metabox_html', 'post', 'normal', 'high' );
}

function pm_konum_metabox_html( $post ) {
    $konum = get_post_meta( $post->ID, '_wm_koordinat', true );
    
    // SABİT HATA DÜZELTMESİ: Küresel ikon ne ise ilk o atanır, boşsa küreselle başlar
    $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
    $ikon_secimi = get_post_meta( $post->ID, '_wm_ozel_ikon', true );
    if ( empty($ikon_secimi) ) { $ikon_secimi = $varsayilan_ayar_pin; }

    $selected_waymark = get_post_meta( $post->ID, '_wm_waymark_id', true );
    $tahmini_rota_data = get_post_meta( $post->ID, '_wm_tahmini_rota', true );
    $saved_color = get_post_meta( $post->ID, '_wm_rota_renk', true ) ? get_post_meta( $post->ID, '_wm_rota_renk', true ) : get_option('pm_default_line_color', '#ff3388');
    
    // AKILLI HARİTA MERKEZİ: Yeni çizilecek rota ise en son eklenen rotanın bittiği koordinatları al
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
            colorPicker = document.getElementById('pm_line_color_picker');
            
        if (typeof L === "undefined") return;

        // AKILLI BAŞLANGIÇ MERKEZİ: Yazıda konum yoksa en son eklenen rotanın bittiği yere odaklan
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

        // MOD DEĞİŞİRKEN VERİLERİ VE SON GÜNCEL HALİ KORUMA MOTORU
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

            // SÜRÜKLEYEREK ROTAYI DEĞİŞTİRME ÖZELLİĞİ AKTİF (waypoints ile entegre)
            routingControl = L.Routing.control({
                waypoints: wps,
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving' }),
                lineOptions: { styles: [{ color: colorPicker.value, opacity: 0.8, weight: 4 }] },
                fitSelectedRoutes: false,
                routeWhileDragging: true // Sürüklerken anlık rota hesaplama tetikleyicisi
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
    if ( isset( $_POST['wm_tahmini_rota'] ) ) update_post_meta( $post_id, '_wm_tahmini_rota', $_POST['wm_tahmini_rota'] );
    if ( isset( $_POST['wm_rota_renk'] ) ) update_post_meta( $post_id, '_wm_rota_renk', sanitize_hex_color($_POST['wm_rota_renk']) );
}

// 6. FRONT-END SHORTCODE [yazi-haritasi] (ÇOKLU PİN KART DESTEKLİ)
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

    // Popup link görünürlük parametreleri
    $show_waymark_opt = get_option('pm_popup_show_waymark', '1');
    $show_blog_opt    = get_option('pm_popup_show_blog', '1');
    $global_secondary_color = get_option('pm_secondary_line_color', '#555555');

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

            // POPUP LİNK KRİTER MOTORU (İSTEKLERE GÖRE YAPILANDIRMA)
            $link_html = '';
            if ($show_waymark_opt === '1' && $show_blog_opt === '1') {
                // Her ikisi de aktifse: Sol köşeye route.png simgesi (Waymark için) + Başlık (Blog için)
                $link_html .= '<div style="display:flex; align-items:center; gap:8px; margin-top:5px;">';
                $link_html .= '<a href="'.esc_url($waymark_url).'" target="_blank" title="Waymark Haritası"><img src="'.plugin_dir_url(__FILE__).'data/sys/route.png" style="width:20px; height:20px; display:block;" onerror="this.style.display=\'none\'"/></a>';
                $link_html .= '<strong><a href="'.esc_url($blog_url).'" target="_blank">'.esc_html($title).'</a></strong>';
                $link_html .= '</div>';
            } elseif ($show_waymark_opt === '1' && $show_blog_opt !== '1') {
                // Sadece Waymark aktifse
                $link_html .= '<strong><a href="'.esc_url($waymark_url).'" target="_blank">'.esc_html($title).' (Harita)</a></strong>';
            } elseif ($show_waymark_opt !== '1' && $show_blog_opt === '1') {
                // Sadece Blog aktifse
                $link_html .= '<strong><a href="'.esc_url($blog_url).'" target="_blank">'.esc_html($title).'</a></strong>';
            } else {
                // İkisi de kapalıysa sadece yalın başlık
                $link_html .= '<strong>'.esc_html($title).'</strong>';
            }

            $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
            $final_pin_key = !empty($ikon_secimi) ? $ikon_secimi : $varsayilan_ayar_pin;
            $final_pin_url = isset($all_pins[$final_pin_key]) ? $all_pins[$final_pin_key]['url'] : $all_pins['leaflet-default']['url'];

            $markers_js_data[] = array(
                'id' => $post_id,
                'sub_cat' => pm_get_post_sub_category_id($post_id),
                'lat' => floatval(trim($parts[0])), 'lng' => floatval(trim($parts[1])),
                'title' => $title, 'gorsel' => $gorsel, 'link_html' => $link_html,
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
    .pm-popup-multi-container { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; width: 230px; padding-right: 4px; }
    .pm-popup-card { border: 1px solid #eee; border-radius: 4px; padding: 6px; background: #fafafa; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .pm-popup-card img { width: 100%; height: auto; border-radius: 2px; margin-bottom: 4px; display: block; }
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

        // AYNI KONUMDAKİ PİNLERİ GRUPLAMA MOTORU
        var groupedMarkers = {};
        mapData.forEach(function(item) {
            var key = item.lat.toFixed(6) + "_" + item.lng.toFixed(6);
            if(!groupedMarkers[key]) { groupedMarkers[key] = []; }
            groupedMarkers[key].push(item);
        });

        // Ekrana pinleri ve çoklu kart popuplarını basma alanı
        Object.keys(groupedMarkers).forEach(function(key) {
            var itemsInLocation = groupedMarkers[key];
            var firstItem = itemsInLocation[0];
            boundsArray.push([firstItem.lat, firstItem.lng]);

            var opts = {}; 
            if (!firstItem.is_default) { 
                opts.icon = L.icon({ iconUrl: firstItem.icon_url, iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] }); 
            }
            
            // Popup İçeriği Kart Jeneratörü
            var popupMasterHtml = '<div class="pm-popup-multi-container">';
            itemsInLocation.forEach(function(innerCard) {
                popupMasterHtml += '<div class="pm-popup-card">';
                if(innerCard.gorsel) { popupMasterHtml += '<img src="'+innerCard.gorsel+'" />'; }
                popupMasterHtml += innerCard.link_html;
                popupMasterHtml += '</div>';
            });
            popupMasterHtml += '</div>';

            var marker = L.marker([firstItem.lat, firstItem.lng], opts).addTo(feMap).bindPopup(popupMasterHtml);

            marker.on('click', function() {
                activeRoutesGroup.clearLayers();
                var subcatFadeEnabled = <?php echo pm_is_feature_active('subcat_fade') ? 'true' : 'false'; ?>;
                var secondaryGlobalColor = '<?php echo esc_js($global_secondary_color); ?>';

                // Tıklanan konumdaki tüm yazılar için rotaları çizdir
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

        // OTOMATİK AKILLI ZOOM (FitBounds)
        if (boundsArray.length > 0) { feMap.fitBounds(boundsArray, { padding: [50, 50] }); }
        else { feMap.setView([39.9334, 32.8597], 6); }
    });
    </script>
    <?php
    return ob_get_clean();
}

// 7. DIŞA AKTARMA MOTORU
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