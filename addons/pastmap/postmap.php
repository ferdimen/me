<?php
/**
 * Plugin Name: PostMap
 * Description: Yazılara konum ve Waymark rotaları ekler, dinamik autocomplete arama sunar, data/img klasöründeki pinleri görsel olarak yönetir, harita veri.json çıktısı verir, tek merkezden toplu ikon yönetimi ve GitHub güncelleyici içerir.
 * Version: 4.6
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
    ?>
    <div class="wrap" style="margin-top: 20px;">
        <div style="margin-bottom: 25px;">
            <img src="https://ferdimen.github.io/me/img/logo.png" style="max-height: 80px; width: auto; display: block;" alt="Ferdimen Logo" />
        </div>
        <h1>Ferdimen Addons Merkezi</h1>
        <p>Geliştirdiğin tüm özel WordPress eklentilerini ve araçlarını bu çatı altından yönetebilirsin.</p>
        <div style="background: #fff; padding: 20px; border-left: 4px solid #0073aa; margin-top: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 800px;">
            <h3>Aktif Araçlar:</h3>
            <ul>
                <li><strong>PostMap (v4.6):</strong> Harita altı pin seçimi, hafifletilmiş veri dışa aktarma ve entegre GitHub Updater.</li>
            </ul>
        </div>
    </div>
    <?php
}

// 2. DİNAMİK KLASÖR TARAMA MOTORU
function pm_get_local_pin_images() {
    $pins = array();
    $pins['leaflet-default'] = array(
        'url'  => 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        'name' => 'Standart Leaflet',
        'is_system' => true
    );

    $pin_dir = plugin_dir_path( __FILE__ ) . 'data/img/';
    $pin_url = plugin_dir_url( __FILE__ ) . 'data/img/';

    if ( is_dir( $pin_dir ) ) {
        $files = glob( $pin_dir . '*.png' );
        if ( $files ) {
            foreach ( $files as $file ) {
                $filename = basename( $file );
                $key = pathinfo( $filename, PATHINFO_FILENAME );
                $pins[$key] = array(
                    'url'  => $pin_url . $filename,
                    'name' => ucwords( str_replace( array('-', '_'), ' ', $key ) ),
                    'is_system' => false
                );
            }
        }
    }
    return $pins;
}

// 3. AYARLAR VE YÖNETİM SAYFASI
add_action( 'admin_init', 'pm_eklenti_ayarlarini_kaydet' );
function pm_eklenti_ayarlarini_kaydet() {
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_harita_altlik' );
    register_setting( 'pm_harita_ayarlar_grubu', 'pm_varsayilan_pin' );
}

function pm_postmap_admin_page() {
    if ( isset( $_POST['pm_download_json'] ) && check_admin_referer( 'pm_download_nonce_action', 'pm_download_nonce' ) ) {
        pm_generate_json_file();
    }

    if ( isset($_GET['delete_pin_file']) && check_admin_referer('pm_delete_pin_file_nonce') ) {
        $file_to_delete = sanitize_text_field($_GET['delete_pin_file']);
        if ($file_to_delete !== 'leaflet-default') {
            $target_path = plugin_dir_path( __FILE__ ) . 'data/img/' . $file_to_delete . '.png';
            if ( file_exists($target_path) ) {
                @unlink($target_path);
                if ( get_option('pm_varsayilan_pin') === $file_to_delete ) {
                    update_option('pm_varsayilan_pin', 'leaflet-default');
                }
                echo '<div class="updated"><p><code>' . esc_html($file_to_delete) . '.png</code> sunucudan silindi.</p></div>';
            }
        }
    }

    if ( isset($_POST['pm_reset_all_post_icons']) && check_admin_referer('pm_reset_icons_nonce_action', 'pm_reset_icons_nonce') ) {
        $guncel_varsayilan = get_option('pm_varsayilan_pin', 'leaflet-default');
        $args = array('post_type' => 'post', 'posts_per_page' => -1, 'post_status' => 'any');
        $tum_yazilar = get_posts($args); $guncellenen_sayi = 0;
        foreach ($tum_yazilar as $yazi) {
            update_post_meta($yazi->ID, '_wm_ozel_ikon', $guncel_varsayilan);
            $guncellenen_sayi++;
        }
        echo '<div class="updated"><p><strong>Başarılı!</strong> Toplam <strong>' . $guncellenen_sayi . '</strong> yazının ikonu <code>' . esc_html($guncel_varsayilan) . '</code> ile sıfırlandı.</p></div>';
    }

    $secili_altlik = get_option( 'pm_harita_altlik', 'osm' );
    $varsayilan_pin = get_option( 'pm_varsayilan_pin', 'leaflet-default' );
    $mevcut_pinler = pm_get_local_pin_images();
    ?>
    <div class="wrap">
        <h1>PostMap Yönetim Paneli</h1>
        
        <form method="post" action="options.php">
            <?php settings_fields( 'pm_harita_ayarlar_grubu' ); ?>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Varsayılan Harita Altlığı:</th>
                    <td>
                        <label><input type="radio" name="pm_harita_altlik" value="osm" <?php checked( $secili_altlik, 'osm' ); ?> /> <strong>OpenStreetMap</strong></label>&nbsp;&nbsp;&nbsp;&nbsp;
                        <label><input type="radio" name="pm_harita_altlik" value="topo" <?php checked( $secili_altlik, 'topo' ); ?> /> <strong>OpenTopoMap</strong></label>
                    </td>
                </tr>
            </table>

            <hr/>

            <h2>Sistemdeki İkonları Yönet</h2>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 20px; margin-bottom: 20px;">
                <?php foreach ( $mevcut_pinler as $key => $pin ): 
                    $is_selected = ($varsayilan_pin === $key);
                ?>
                    <div style="background: <?php echo $is_selected ? '#f0f6fa' : '#fff'; ?>; border: 2px solid <?php echo $is_selected ? '#0073aa' : '#ccc'; ?>; border-radius: 6px; padding: 15px; width: 140px; text-align: center; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                        <?php if (!$pin['is_system']): ?>
                            <a href="<?php echo wp_nonce_url(admin_url('admin.php?page=wp-to-map-json&delete_pin_file=' . $key), 'pm_delete_pin_file_nonce'); ?>" style="position: absolute; top: 8px; right: 10px; color: #a00; text-decoration: none; font-size: 11px; font-weight: bold;" onclick="return confirm('Silinsin mi?');">✕ Sil</a>
                        <?php endif; ?>
                        <div style="height: 55px; display: flex; align-items: center; justify-content: center; margin-top: 10px; margin-bottom: 10px;">
                            <img src="<?php echo esc_url( $pin['url'] ); ?>" style="max-height: 48px; max-width: 48px; object-fit: contain;" alt="" />
                        </div>
                        <strong style="display: block; font-size: 12px; margin-bottom: 4px;"><?php echo esc_html( $pin['name'] ); ?></strong>
                        <label style="background: <?php echo $is_selected ? '#0073aa' : '#fafafa'; ?>; color: <?php echo $is_selected ? '#fff' : '#555'; ?>; padding: 5px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: block; width: 85%;">
                            <input type="radio" name="pm_varsayilan_pin" value="<?php echo esc_attr($key); ?>" <?php checked($varsayilan_pin, $key); ?> onchange="this.form.submit();" />
                            <?php echo $is_selected ? 'Aktif' : 'Seç'; ?>
                        </label>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php submit_button( 'Ayarları Kaydet' ); ?>
        </form>

        <hr style="margin-top: 30px; margin-bottom: 25px;"/>

        <h2>Gelişmiş Veritabanı Araçları</h2>
        <div style="background: #fff; padding: 20px; border-left: 4px solid #dba617; max-width: 700px;">
            <h3>Tüm Yazı İkonlarını Toplu Sıfırla</h3>
            <p>Sistemdeki tüm yazıları şu an seçili olan varsayılan ikon ile tek seferde günceller.</p>
            <form method="post" action="" onsubmit="return confirm('Tüm yazıların harita pinleri sıfırlanacaktır. Onaylıyor musun?');">
                <?php wp_nonce_field( 'pm_reset_icons_nonce_action', 'pm_reset_icons_nonce' ); ?>
                <input type="submit" name="pm_reset_all_post_icons" class="button button-secondary" style="color: #bc0b0b; border-color: #cc1818;" value="Tüm Yazı İkonlarını Seçili İkon Yap ve Sıfırla">
            </form>
        </div>

        <hr style="margin-top: 30px; margin-bottom: 25px;"/>
        
        <h2>Verileri Dışa Aktar</h2>
        <form method="post" action="">
            <?php wp_nonce_field( 'pm_download_nonce_action', 'pm_download_nonce' ); ?>
            <input type="submit" name="pm_download_json" class="button button-primary button-large" value="veri.json Dosyasını İndir">
        </form>
    </div>
    <?php
}

function pm_get_map_tile_details() {
    if ( get_option( 'pm_harita_altlik', 'osm' ) === 'topo' ) {
        return array('url' => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'attr' => 'Card data: © OpenStreetMap | Style: © OpenTopoMap');
    }
    return array('url' => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'attr' => '© OpenStreetMap contributors');
}

// 4. ADMIN ASSETS
add_action( 'admin_enqueue_scripts', 'pm_admin_assets' );
function pm_admin_assets( $hook ) {
    if ( $hook == 'post.php' || $hook == 'post-new.php' ) {
        wp_enqueue_style( 'leaflet-admin-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', array(), '1.9.4' );
        wp_enqueue_script( 'leaflet-admin-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', array(), '1.9.4', true );
    }
}

// Waymark Harita Arama AJAX
add_action( 'wp_ajax_pm_search_waymark_maps', 'pm_search_waymark_maps_callback' );
function pm_search_waymark_maps_callback() {
    $search_term = isset($_GET['q']) ? sanitize_text_field($_GET['q']) : '';
    $query = new WP_Query(array('post_type' => 'waymark_map', 'post_status' => 'publish', 'posts_per_page' => 15, 's' => $search_term));
    $results = array();
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $map_id = get_the_ID();
            $geojson_url = '';
            if(!empty(get_post_meta($map_id, 'waymark_data', true))) {
                $geojson_url = wp_get_attachment_url(get_post_meta($map_id, 'waymark_geojson_file_id', true));
            }
            $results[] = array('id' => $map_id, 'title' => get_the_title(), 'geojson' => $geojson_url);
        }
        wp_reset_postdata();
    }
    wp_send_json_success($results);
}

// 5. YAZI PANELİ METABOX - (HARİTA PİN SEÇİMİ EN ALTTA)
add_action( 'add_meta_boxes', 'pm_konum_metabox_ekle' );
function pm_konum_metabox_ekle() {
    add_meta_box( 'pm_konum_meta', 'Yazı Konum ve Waymark Rota Ayarları (PostMap)', 'pm_konum_metabox_html', 'post', 'normal', 'high' );
}

function pm_konum_metabox_html( $post ) {
    $konum = get_post_meta( $post->ID, '_wm_koordinat', true );
    $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
    $ikon_secimi = get_post_meta( $post->ID, '_wm_ozel_ikon', true ) ? get_post_meta( $post->ID, '_wm_ozel_ikon', true ) : $varsayilan_ayar_pin;
    $selected_waymark = get_post_meta( $post->ID, '_wm_waymark_id', true );
    $waymark_title = $selected_waymark ? get_the_title($selected_waymark) : '';
    $tile_info = pm_get_map_tile_details();
    $mevcut_pinler = pm_get_local_pin_images();
    
    wp_nonce_field( 'pm_konum_kaydet_nonce', 'pm_konum_nonce' );
    ?>
    <!-- 1. Koordinat Girişi -->
    <div style="margin-bottom: 15px;">
        <label style="display:block; font-weight:bold; margin-bottom:8px;">Koordinatlar (Enlem, Boylam):</label>
        <input type="text" id="wm_koordinat_input" name="wm_koordinat" value="<?php echo esc_attr($konum); ?>" placeholder="41.2112, 27.7724" style="width:100%; font-family:monospace; height: 32px;" />
    </div>

    <!-- 2. Rota Seçimi -->
    <div style="margin-bottom: 15px; background: #f9f9f9; padding: 15px; border: 1px solid #dfdfdf; border-radius: 4px;">
        <label style="display:block; font-weight:bold; margin-bottom:5px;">Waymark Rotası Seçin:</label>
        <div style="display:flex; gap: 10px; align-items: center;">
            <div style="position: relative; flex-grow: 1;">
                <input type="text" id="wm_waymark_autocomplete" autocomplete="off" placeholder="Harita adı yazın..." value="<?php echo esc_attr($waymark_title); ?>" style="width:100%; height: 32px;" />
                <input type="hidden" id="wm_waymark_id_hidden" name="wm_waymark_id" value="<?php echo esc_attr($selected_waymark); ?>" />
                <ul id="wm_autocomplete_results" style="position: absolute; width: 100%; background: #fff; border: 1px solid #ccc; list-style: none; max-height: 200px; overflow-y: auto; z-index: 999; display: none;"></ul>
            </div>
            <button type="button" id="wm_insert_shortcode_btn" class="button button-secondary" style="height: 32px;" <?php echo !$selected_waymark ? 'disabled' : ''; ?>>Kısa Kodu Yazıya Ekle</button>
        </div>
    </div>

    <!-- 3. Harita Önizleme -->
    <div id="wm_admin_harita" style="height: 300px; width: 100%; border: 1px solid #ccc; border-radius:4px; margin-bottom:20px;"></div>

    <!-- 4. Harita Pin Türü Seçimi (HARİTANIN ALTINA ALINDI) -->
    <div style="margin-bottom: 15px;">
        <label style="display:block; font-weight:bold; margin-bottom:8px;">Harita Pin Türü Seçin:</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; background: #fff; padding: 12px; border: 1px solid #ccc; border-radius: 4px;">
            <?php foreach ( $mevcut_pinler as $key => $pin ): ?>
                <label style="cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border: 2px solid <?php echo ($ikon_secimi === $key) ? '#0073aa' : '#eee'; ?>; border-radius: 6px; padding: 10px; width: 110px; text-align: center; background: <?php echo ($ikon_secimi === $key) ? '#f0f6fa' : '#fff'; ?>;" class="pm-pin-label-box">
                    <input type="radio" name="wm_ozel_ikon" value="<?php echo esc_attr($key); ?>" data-url="<?php echo esc_url($pin['url']); ?>" <?php checked($ikon_secimi, $key); ?> style="margin-bottom: 8px;" onchange="updateAdminMarkerIcon(this);" />
                    <div style="height: 40px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                        <img src="<?php echo esc_url( $pin['url'] ); ?>" style="max-height: 38px; max-width: 38px; object-fit: contain;" alt="" />
                    </div>
                    <span style="font-size: 11px; font-weight: 500; line-height: 1.2;"><?php echo esc_html( $pin['name'] ); ?></span>
                </label>
            <?php endforeach; ?>
        </div>
    </div>

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
        var inputEl = document.getElementById('wm_waymark_autocomplete'), hiddenEl = document.getElementById('wm_waymark_id_hidden'), resultsEl = document.getElementById('wm_autocomplete_results'), shortcodeBtn = document.getElementById('wm_insert_shortcode_btn'), coordInput = document.getElementById('wm_koordinat_input'), debounceTimer;
        if (typeof L === "undefined") return;

        var defaultLat = 41.2112, defaultLng = 27.7724;
        if(coordInput.value) { var parts = coordInput.value.split(','); if(parts.length === 2) { defaultLat = parseFloat(parts[0].trim()); defaultLng = parseFloat(parts[1].trim()); } }
        
        var map = L.map('wm_admin_harita').setView([defaultLat, defaultLng], 10);
        L.tileLayer('<?php echo $tile_info["url"]; ?>', { maxZoom: 18, attribution: '<?php echo esc_js($tile_info["attr"]); ?>' }).addTo(map);

        var currentSelectedRadio = document.querySelector('input[name="wm_ozel_ikon"]:checked');
        var initialIcon = (currentSelectedRadio && currentSelectedRadio.value !== 'leaflet-default') ? L.icon({ iconUrl: currentSelectedRadio.getAttribute('data-url'), iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] }) : new L.Icon.Default();

        globalAdminMarker = L.marker([defaultLat, defaultLng], {draggable: true, icon: initialIcon}).addTo(map);
        map.on('click', function(e) { globalAdminMarker.setLatLng(e.latlng); coordInput.value = e.latlng.lat.toFixed(14) + ", " + e.latlng.lng.toFixed(14); });
        globalAdminMarker.on('dragend', function(e) { coordInput.value = globalAdminMarker.getLatLng().lat.toFixed(14) + ", " + globalAdminMarker.getLatLng().lng.toFixed(14); });

        inputEl.addEventListener('input', function() {
            var value = this.value.trim(); clearTimeout(debounceTimer); if (value.length < 2) { resultsEl.style.display = 'none'; return; }
            debounceTimer = setTimeout(function() {
                fetch(ajaxurl + '?action=pm_search_waymark_maps&q=' + encodeURIComponent(value)).then(res => res.json()).then(res => {
                    if (res.success && res.data.length > 0) {
                        resultsEl.innerHTML = ''; resultsEl.style.display = 'block';
                        res.data.forEach(function(item) {
                            var li = document.createElement('li'); li.textContent = item.title; li.style.padding = '8px 12px'; li.style.cursor = 'pointer';
                            li.addEventListener('click', function() {
                                inputEl.value = item.title; hiddenEl.value = item.id; resultsEl.style.display = 'none'; shortcodeBtn.removeAttribute('disabled');
                                if(item.geojson) {
                                    fetch(item.geojson).then(r => r.json()).then(geo => {
                                        if (geo.features && geo.features.length > 0) {
                                            var geom = geo.features[0].geometry; var coords = (geom.type === "LineString") ? geom.coordinates[0] : (geom.type === "Point" ? geom.coordinates : null);
                                            if (coords) { var lat = coords[1].toFixed(14), lng = coords[0].toFixed(14); coordInput.value = lat + ", " + lng; var nLL = new L.LatLng(lat, lng); globalAdminMarker.setLatLng(nLL); map.setView(nLL, 12); }
                                        }
                                    });
                                }
                            });
                            resultsEl.appendChild(li);
                        });
                    }
                });
            }, 300);
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
    if ( isset( $_POST['wm_waymark_id'] ) ) update_post_meta( $post_id, '_wm_waymark_id', sanitize_text_field( $_POST['wm_waymark_id'] ) );
}

// 6. FRONT-END SHORTCODE [yazi-haritasi]
add_shortcode( 'yazi-haritasi', 'pm_frontend_harita_shortcode' );
function pm_frontend_harita_shortcode() {
    wp_enqueue_style( 'leaflet-fe-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', array(), '1.9.4' );
    wp_enqueue_script( 'leaflet-fe-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', array(), '1.9.4', true );

    $tile_info = pm_get_map_tile_details(); $all_pins = pm_get_local_pin_images();
    $query = new WP_Query(array('post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1, 'meta_query' => array(array('key' => '_wm_koordinat', 'compare' => 'EXISTS'))));
    $markers_js_data = array();

    if ( $query->have_posts() ) {
        while ( $query->have_posts() ) {
            $query->the_post();
            $koordinat_raw = get_post_meta( get_the_ID(), '_wm_koordinat', true );
            $ikon_secimi   = get_post_meta( get_the_ID(), '_wm_ozel_ikon', true );
            $waymark_id    = get_post_meta( get_the_ID(), '_wm_waymark_id', true );
            if ( ! $koordinat_raw ) continue;

            $parts = explode( ',', $koordinat_raw ); if ( count( $parts ) !== 2 ) continue;
            $gorsel = get_the_post_thumbnail_url( get_the_ID(), 'medium' ) ? get_the_post_thumbnail_url( get_the_ID(), 'medium' ) : '';
            
            $geojson_url = '';
            if($waymark_id && !empty(get_post_meta($waymark_id, 'waymark_data', true))) {
                $geojson_url = wp_get_attachment_url(get_post_meta($waymark_id, 'waymark_geojson_file_id', true));
            }

            $popup_html = '<div style="max-width:200px;">';
            if ( $gorsel ) $popup_html .= '<img src="' . esc_url($gorsel) . '" style="width:100%; height:auto;" />';
            $popup_html .= '<h4><a href="' . get_permalink() . '" target="_blank">' . esc_html(get_the_title()) . '</a></h4></div>';

            $varsayilan_ayar_pin = get_option('pm_varsayilan_pin', 'leaflet-default');
            $final_pin_key = !empty($ikon_secimi) ? $ikon_secimi : $varsayilan_ayar_pin;
            $final_pin_url = isset($all_pins[$final_pin_key]) ? $all_pins[$final_pin_key]['url'] : $all_pins['leaflet-default']['url'];

            $markers_js_data[] = array(
                'lat' => floatval(trim($parts[0])), 'lng' => floatval(trim($parts[1])),
                'popup' => $popup_html, 'geojson' => $geojson_url,
                'is_default' => ($final_pin_key === 'leaflet-default'), 'icon_url' => $final_pin_url
            );
        }
        wp_reset_postdata();
    }

    ob_start();
    ?>
    <div id="wm_frontend_map" style="height: 550px; width: 100%; border: 1px solid #ddd; border-radius: 8px;"></div>
    <script>
    document.addEventListener("DOMContentLoaded", function() {
        if (typeof L === "undefined") return;
        var mapData = <?php echo json_encode( $markers_js_data ); ?>;
        var startCenter = mapData.length > 0 ? [mapData[0].lat, mapData[0].lng] : [39.9334, 32.8597];
        var feMap = L.map('wm_frontend_map').setView(startCenter, 7);
        L.tileLayer('<?php echo $tile_info["url"]; ?>', { maxZoom: 17, attribution: '<?php echo esc_js($tile_info["attr"]); ?>' }).addTo(feMap);
        var activeRouteLayer = null;

        mapData.forEach(function(item) {
            var opts = {}; if (!item.is_default) { opts.icon = L.icon({ iconUrl: item.icon_url, iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35] }); }
            var marker = L.marker([item.lat, item.lng], opts).addTo(feMap).bindPopup(item.popup);
            marker.on('click', function() {
                if(activeRouteLayer) { feMap.removeLayer(activeRouteLayer); activeRouteLayer = null; }
                if(item.geojson) { fetch(item.geojson).then(r => r.json()).then(geo => { activeRouteLayer = L.geoJSON(geo, { style: { color: '#ff3388', weight: 5 } }).addTo(feMap); feMap.fitBounds(activeRouteLayer.getBounds()); }); }
            });
        });
    });
    </script>
    <?php
    return ob_get_clean();
}

// 7. YENİLENMİŞ SADECE TALEP EDİLEN VERİLERİ DIŞA AKTARMA MOTORU
function pm_generate_json_file() {
    $args = array('post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1, 'orderby' => 'date', 'order' => 'ASC');
    $query = new WP_Query( $args ); $json_output = array();

    if ( $query->have_posts() ) {
        while ( $query->have_posts() ) {
            $query->the_post();
            $koordinat_raw = get_post_meta( get_the_ID(), '_wm_koordinat', true );
            $waymark_id    = get_post_meta( get_the_ID(), '_wm_waymark_id', true );
            
            // Eğer koordinat hiç girilmediyse varsayılan merkez atansın
            $enlem = 41.2112; $boylam = 27.7724;
            if ( $koordinat_raw ) {
                $parts = explode( ',', $koordinat_raw );
                if(count($parts) === 2){ $enlem = floatval(trim($parts[0])); $boylam = floatval(trim($parts[1])); }
            }

            // Waymark rotasının tam linkini alalım (veya harita yönetim linki)
            $waymark_linki = "";
            if($waymark_id) {
                $waymark_linki = get_permalink($waymark_id) ? get_permalink($waymark_id) : admin_url("post.php?post={$waymark_id}&action=edit");
            }

            $gorsel = get_the_post_thumbnail_url( get_the_ID(), 'full' ) ? get_the_post_thumbnail_url( get_the_ID(), 'full' ) : '';

            // Sadece istenen şemayı oluşturuyoruz
            $json_output[] = array(
                'yazi_basligi'       => get_the_title(),
                'koordinat'          => array( $enlem, $boylam ),
                'waymark_rota_linki' => $waymark_linki,
                'kapak_resmi'        => $gorsel
            );
        }
        wp_reset_postdata();
    }

    header( 'Content-Type: application/json; charset=utf-8' );
    header( 'Content-Disposition: attachment; filename="veri.json"' );
    echo json_encode( $json_output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
    exit;
}

// =========================================================================
// GİTHUB OTOMATİK GÜNCELLEME MOTORU (GITHUB UPDATER)
// =========================================================================
add_filter( 'pre_set_site_transient_update_plugins', 'pm_github_updater_kontrol' );
function pm_github_updater_kontrol( $transient ) {
    if ( empty( $transient->checked ) ) return $transient;
    $github_raw_url = 'https://raw.githubusercontent.com/ferdimen/me/main/addons/postmap/postmap.php';
    $github_zip_url = 'https://github.com/ferdimen/me/archive/refs/heads/main.zip';

    $response = wp_remote_get( $github_raw_url );
    if ( is_wp_error( $response ) ) return $transient;
    $icerik = wp_remote_retrieve_body( $response );
    
    if ( preg_match( '/Version:\s*([0-9.]+)/i', $icerik, $matches ) ) {
        $uzaktaki_versiyon = $matches[1];
        $yerel_eklenti_yolu = plugin_basename( __FILE__ );
        $yerel_versiyon = $transient->checked[ $yerel_eklenti_yolu ];

        if ( version_compare( $yerel_versiyon, $uzaktaki_versiyon, '<' ) ) {
            $obj = new stdClass(); $obj->slug = 'postmap'; $obj->plugin = $yerel_eklenti_yolu;
            $obj->new_version = $uzaktaki_versiyon; $obj->url = 'https://github.com/ferdimen/me'; $obj->package = $github_zip_url;
            $transient->response[ $yerel_eklenti_yolu ] = $obj;
        }
    }
    return $transient;
}

add_filter( 'upgrader_source_selection', 'pm_github_updater_klasor_duzelt', 10, 4 );
function pm_github_updater_klasor_duzelt( $source, $remote_source, $upgrader, $hook_extra ) {
    if ( isset( $hook_extra['plugin'] ) && $hook_extra['plugin'] === plugin_basename( __FILE__ ) ) {
        $eklenti_klasor_adi = dirname( plugin_basename( __FILE__ ) );
        $corrected_source = trailingslashit( $remote_source ) . $eklenti_klasor_adi . '/';
        if ( is_dir( $corrected_source ) ) return $corrected_source;
    }
    return $source;
}