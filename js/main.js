/**
 * 🎯 CONFIG MANAGER - Gestión centralizada de configuración persistente
 * Maneja la carga y guardado de configuraciones en localStorage
 * Evita duplicación de código y proporciona interfaz consistente
 */
class ConfigManager {
    /**
     * Carga toda la configuración persistente del usuario
     * @returns {Object} Configuración completa con idioma, tema y filtros
     */
    static load() {
        return {
            language: localStorage.getItem('preferredLanguage') || 'es',
            theme: localStorage.getItem('theme') || 'auto',
            filters: JSON.parse(localStorage.getItem('projectFilters') || '{}')
        };
    }

    /**
     * Guarda configuración en localStorage con manejo de errores
     * @param {Object} config - Configuración a guardar
     * @param {string} config.language - Idioma preferido
     * @param {string} config.theme - Tema preferido ('light', 'dark', 'auto')
     * @param {Object} config.filters - Filtros de proyectos activos
     */
    static save(config) {
        try {
            if (config.language) {
                localStorage.setItem('preferredLanguage', config.language);
            }
            if (config.theme && config.theme !== 'auto') {
                localStorage.setItem('theme', config.theme);
            }
            if (config.filters) {
                localStorage.setItem('projectFilters', JSON.stringify(config.filters));
            }
        } catch (error) {
            console.warn('Error guardando configuración:', error);
        }
    }

    /**
     * Elimina toda la configuración persistente (para testing/debug)
     */
    static clear() {
        localStorage.removeItem('preferredLanguage');
        localStorage.removeItem('theme');
        localStorage.removeItem('projectFilters');
    }
}

/**
 * 🌐 I18N - Sistema de internacionalización
 * Maneja carga de traducciones y cambio de idioma
 */
class I18n {
    /**
     * @constructor
     * @param {string} defaultLang - Idioma por defecto ('es' o 'en')
     */
    constructor(defaultLang = "es") {
        /** @type {string} Idioma actual */
        this.lang = defaultLang;
        /** @type {Object} Traducciones cargadas */
        this.translations = {};
        
        this.loadTranslations(this.lang);

        // Event listener para cambio de idioma
        document.getElementById("lang-switch").addEventListener("click", () => {
            this.switchLanguage(this.lang === "es" ? "en" : "es");
        });
    }

    /**
     * Carga traducciones desde archivo JSON
     * @param {string} lang - Idioma a cargar
     * @async
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`js/i18n/${lang}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.translations = await response.json();
            this.lang = lang;
            this.updateTextContent();
        } catch (err) {
            console.error("Error cargando traducciones:", err);
            // Fallback a traducciones vacías
            this.translations = {};
        }
    }

    /**
     * Actualiza todos los textos en la UI con las traducciones cargadas
     */
    updateTextContent() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (this.translations[key]) {
                if (el.tagName.toLowerCase() === "title") {
                    document.title = this.translations[key];// Manejo especial para <title>
                } else {
                    el.textContent = this.translations[key];
                    el.setAttribute("aria-label", this.translations[key]);// accesibilidad
                }
            }
        });

        // Actualizar botón de idioma
        const langBtn = document.getElementById("lang-switch");
        langBtn.textContent = this.lang === "es" ? "EN" : "ES";
        langBtn.setAttribute("aria-label", this.lang === "es" ? "Switch to English" : "Cambiar a Español");
    }

    /**
     * Cambia el idioma y guarda la preferencia
     * @param {string} lang - Nuevo idioma
     */
    switchLanguage(lang) {
        ConfigManager.save({ language: lang });
        this.loadTranslations(lang);
    }

    /**
     * Traduce una clave de texto
     * @param {string} key - Clave de traducción
     * @returns {string} Texto traducido o la clave si no se encuentra
     */
    translate(key) {
        return this.translations[key] || key;
    }
}

/**
 * 🎨 THEME MANAGER - Gestión de tema claro/oscuro
 * Maneja persistencia y cambio de tema visual
 */
class ThemeManager {
    /**
     * @constructor
     * @param {I18n} i18n - Instancia de internacionalización para textos
     */
    constructor(i18n) {
        /** @type {HTMLElement} Botón de toggle de tema */
        this.toggleBtn = document.getElementById("theme-toggle");
        /** @type {I18n} Instancia de i18n para traducciones */
        this.i18n = i18n;

        this.initTheme();
        this.toggleBtn.addEventListener("click", () => this.toggleTheme());
    }

    /**
     * Inicializa el tema con preferencias guardadas o detección automática
     */
    initTheme() {
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        
        const isDark = savedTheme ? savedTheme === "dark" : prefersDark;
        document.documentElement.classList.toggle("dark", isDark);
        
        this.updateIcon(isDark);
    }

    /**
     * Alterna entre tema claro y oscuro
     */
    toggleTheme() {
        const isCurrentlyDark = document.documentElement.classList.contains("dark");
        const newTheme = !isCurrentlyDark ? "dark" : "light";
        
        document.documentElement.classList.toggle("dark", !isCurrentlyDark);
        ConfigManager.save({ theme: newTheme });
        
        this.updateIcon(!isCurrentlyDark);
    }

    /**
     * Actualiza el icono y texto del botón de tema
     * @param {boolean} isDark - Si el tema actual es oscuro
     */
    updateIcon(isDark) {
        this.toggleBtn.textContent = isDark ? "☀️" : "🌙";
        
        if (this.i18n.translations) {
            this.toggleBtn.setAttribute(
                "aria-label",
                this.i18n.translations[isDark ? "theme_light" : "theme_dark"]
            );
            this.toggleBtn.setAttribute(
                "data-i18n",
                isDark ? "theme_light" : "theme_dark"
            );
        }
    }
}

/**
 * 📂 PROJECT LOADER - Carga y filtrado de proyectos
 * Maneja visualización, filtrado y lazy loading de imágenes
 */
class ProjectLoader {
    /**
     * @constructor
     * @param {string} language - Idioma inicial
     * @param {Object} initialFilters - Filtros iniciales a aplicar
     */
    constructor(language = "es", initialFilters = {}) {
        /** @type {string} Idioma actual para textos */
        this.language = language;
        /** @type {HTMLElement} Contenedor de proyectos */
        this.container = document.querySelector("#projects-container");
        /** @type {Array} Lista completa de proyectos */
        this.allProjects = [];
        /** @type {Object} Filtros activos actualmente */
        this.activeFilters = initialFilters;
        /** @type {Set} Imágenes siendo observadas para lazy loading */
        this.observedImages = new Set();
        /** @type {IntersectionObserver} Observer para lazy loading */
        this.observer = null;

        // Mapeo de IDs a textos para categorías y modalidades
        this.categoryMap = {
            1: language === 'es' ? 'Web' : 'Web',
            2: language === 'es' ? 'Móvil' : 'Mobile',
            3: language === 'es' ? 'Particular' : 'Particular'
        };
        
        this.modeMap = {
            1: language === 'es' ? 'Independiente' : 'Independent',
            2: language === 'es' ? 'Colaboración' : 'Collaboration'
        };

        this.initObserver();
        this.setupFilterListeners();
        this.loadProjects(language).then(() => {
            this.applySavedFilters();
        });
    }

    /**
     * Inicializa el Intersection Observer para lazy loading
     */
    initObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observedImages.clear();
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, {
            root: null,           // Viewport como área contenedora
            rootMargin: '50px',   // márgenes adicionales
            threshold: 0.1        // Dispara cuando 10% de la imagen es visible
        });
    }

    /**
     * Configura event listeners para los filtros
     */
    setupFilterListeners() {
        // Event delegation para botones de filtro
        document.querySelector("#project-filters").addEventListener("click", (e) => {
            if (e.target.matches("[data-filter]")) {
                this.handleFilterClick(e.target);
            }
        });
        
        // Botón limpiar filtros
        document.querySelector("#clear-filters").addEventListener("click", () => {
            this.clearFilters();
        });
    }

    /**
     * Maneja el clic en un botón de filtro
     * @param {HTMLElement} button - Botón clickeado
     */
    handleFilterClick(button) {
        const filterType = button.dataset.filter;
        const filterValue = button.dataset.value;

        // Alternar selección (toggle)
        this.activeFilters[filterType] = 
            this.activeFilters[filterType] === filterValue ? null : filterValue;

        // Actualizar estado visual
        document.querySelectorAll(`#project-filters button[data-filter="${filterType}"]`)
            .forEach(btn => btn.classList.remove("active"));

        if (this.activeFilters[filterType]) {
            button.classList.add("active");
        }

        this.applyFilters();
    }

    /**
     * Limpia todos los filtros aplicados
     */
    clearFilters() {
        this.activeFilters = {};
        ConfigManager.save({ filters: {} });
        
        document.querySelectorAll("#project-filters button[data-filter]")
            .forEach(btn => btn.classList.remove("active"));
        
        this.renderProjects(this.allProjects);
    }

    /**
     * Carga proyectos desde archivo JSON
     * @param {string} lang - Idioma de los proyectos a cargar
     * @async
     * @returns {Promise<boolean>} True si la carga fue exitosa
     */
    async loadProjects(lang) {
        try {
            const response = await fetch(`js/i18n/projects_${lang}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.allProjects = await response.json();
            this.renderProjects(this.allProjects);
            return true;
        } catch (error) {
            console.error("Error al cargar proyectos:", error);
            this.showErrorMessage();
            return false;
        }
    }

    /**
     * Muestra mensaje de error cuando falla la carga de proyectos
     */
    showErrorMessage() {
        this.container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${this.language === "es" ? 
                    "Error al cargar proyectos. Por favor, intenta recargar la página." : 
                    "Error loading projects. Please try reloading the page."}</p>
            </div>
        `;
    }

    /**
     * Aplica filtros guardados visualmente y lógicamente
     */
    applySavedFilters() {
        // Aplicar visualmente los filtros activos
        Object.entries(this.activeFilters).forEach(([filterType, value]) => {
            if (value) {
                const button = document.querySelector(
                    `button[data-filter="${filterType}"][data-value="${value}"]`
                );
                if (button) {
                    button.classList.add("active");
                }
            }
        });
        
        // Aplicar la filtración
        this.applyFilters();
    }

    /**
     * Aplica los filtros activos a los proyectos
     */
    applyFilters() {
        // Guardar filtros actuales
        ConfigManager.save({ filters: this.activeFilters });
        
        const filtered = this.filterProjects();
        this.renderProjects(filtered);
    }

    /**
     * Filtra los proyectos según los criterios activos
     * @returns {Array} Proyectos filtrados
     */
    filterProjects() {
        return this.allProjects.filter(project => {
            return Object.entries(this.activeFilters).every(([key, value]) => {
                if (!value) return true; // Si no hay filtro, incluir proyecto
                
                const projectValue = project[key];
                if (Array.isArray(projectValue)) {
                    return projectValue.includes(value);
                }
                return projectValue === value;
            });
        });
    }

    /**
     * Renderiza proyectos en el contenedor
     * @param {Array} projects - Proyectos a renderizar
     */
    renderProjects(projects) {
        if (projects.length === 0) {
            this.showNoProjectsMessage();
            return;
        }

        const fragment = document.createDocumentFragment();
        
        projects.forEach((project, index) => {
            const card = this.createProjectCard(project, index);
            fragment.appendChild(card);
        });

        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    /**
     * Muestra mensaje cuando no hay proyectos que coincidan
     */
    showNoProjectsMessage() {
        this.container.innerHTML = `
            <div class="no-projects-message">
                <i class="fas fa-search"></i>
                <p data-i18n="no_projects">${this.language === "es" ? 
                    "No hay proyectos que coincidan con los filtros." : 
                    "No projects match the selected filters."}</p>
            </div>
        `;
    }

    /**
     * Crea elemento de tarjeta de proyecto
     * @param {Object} project - Datos del proyecto
     * @param {number} index - Índice para animación
     * @returns {HTMLElement} Elemento de tarjeta de proyecto
     */
    createProjectCard(project, index) {
        const card = document.createElement("article");
        card.classList.add("project-card");
        card.style.animationDelay = `${index * 0.1}s`;
        
        const hasImage = project.media && project.media !== "#";
        const hasContribution = project.contribution && project.contribution !== "#";
        
        card.innerHTML = this.getProjectCardHTML(project, hasImage, hasContribution);
        
        // Configurar lazy loading para imágenes
        if (hasImage) {
            const img = card.querySelector('img');
            this.observer.observe(img);
            this.observedImages.add(img);
        }
        
        return card;
    }

    /**
     * Genera HTML para tarjeta de proyecto
     * @param {Object} project - Datos del proyecto
     * @param {boolean} hasImage - Si tiene imagen
     * @param {boolean} hasContribution - Si tiene contribución
     * @returns {string} HTML de la tarjeta
     */
    getProjectCardHTML(project, hasImage, hasContribution) {
        // Convertir IDs a textos para mostrar
        const categoryText = this.categoryMap[project.category] || project.category;
        const modeText = this.modeMap[project.mode] || project.mode;

        return `
            ${hasImage ? 
                `<img data-src="${project.media}" alt="${project.title}" class="project-img lazy" loading="lazy">` : 
                `<div class="project-placeholder"><i class="fas fa-image"></i></div>`
            }
            <h3>${project.title}</h3>
            <p>${project.description}</p>

            ${hasContribution ?
                `<p><strong>${this.language === "es" ? "Contribución:" : "Contribution:"}</strong> ${project.contribution}</p>`
                : ""
            }

            <p><strong>${this.language === "es" ? "Tecnologías:" : "Technologies:"}</strong> ${project.tech.join(", ")}</p>
            <p><strong>${this.language === "es" ? "Categoría:" : "Category:"}</strong> ${categoryText}</p>
            <p><strong>${this.language === "es" ? "Modalidad:" : "Mode:"}</strong> ${modeText}</p>

            <div class="project-links">
                ${project.site !== "#" ? 
                    `<a href="${project.site}" target="_blank" aria-label="${this.language === "es" ? "Visitar sitio web" : "Visit website"}">
                        🌐 ${this.language === "es" ? "Sitio" : "Website"}
                    </a>` : ""}
                ${project.demo !== "#" ? 
                    `<a href="${project.demo}" target="_blank" aria-label="Ver demo">
                        🎬 Demo
                    </a>` : ""}
                ${project.code !== "#" ? 
                    `<a href="${project.code}" target="_blank" aria-label="${this.language === "es" ? "Ver código fuente" : "View source code"}">
                        💻 ${this.language === "es" ? "Código" : "Code"}
                    </a>` : ""}
            </div>
        `;
    }

    /**
     * Carga imagen individual (lazy loading)
     * @param {HTMLImageElement} img - Elemento imagen a cargar
     */
    loadImage(img) {
        img.src = img.dataset.src;// Carga la imagen real -> creo
        img.onload = () => {
            img.classList.remove('lazy');
            img.classList.add('loaded');
        };
        this.observer.unobserve(img);// Deja de observar -> creo
        this.observedImages.delete(img);
    }

    /**
     * Cambia idioma manteniendo filtros actuales
     * @param {string} lang - Nuevo idioma
     */
    changeLanguage(lang) {
        this.language = lang;
        
        // Actualizar los mapas de texto para el nuevo idioma
        this.categoryMap = {
            1: lang === 'es' ? 'Web' : 'Web',
            2: lang === 'es' ? 'Móvil' : 'Mobile',
            3: lang === 'es' ? 'Particular' : 'Particular'
        };
        
        this.modeMap = {
            1: lang === 'es' ? 'Independiente' : 'Independent',
            2: lang === 'es' ? 'Colaboración' : 'Collaboration'
        };

        this.loadProjects(lang).then(() => {
            // Re-aplicar filtros existentes después de cambiar idioma
            this.applyFilters();
        });
    }

    /**
     * Limpia recursos y event listeners
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.observedImages.clear();
        
        // Remover event listeners
        const filtersContainer = document.querySelector("#project-filters");
        const newFiltersContainer = filtersContainer.cloneNode(true);
        filtersContainer.parentNode.replaceChild(newFiltersContainer, filtersContainer);
    }
}

/**
 * 📧 CONTACT FORM - Manejo de formulario de contacto
 * Validación y envío de formulario con feedback visual
 */
class ContactForm {
    /**
     * @constructor
     * @param {I18n} i18n - Instancia de internacionalización
     */
    constructor(i18n) {
        /** @type {I18n} Instancia de i18n para mensajes */
        this.i18n = i18n;
        /** @type {HTMLFormElement} Formulario de contacto */
        this.form = document.querySelector("#contact-form");
        /** @type {HTMLElement} Elemento para mensajes de estado */
        this.status = document.querySelector("#form-status");

        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    /**
     * Maneja el envío del formulario
     * @param {Event} e - Evento de submit
     * @async
     */
    async handleSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.form);
        const { name, email, message } = Object.fromEntries(formData);
        
        // Validaciones
        if (!this.validateForm(name, email, message)) {
            return;
        }

        this.setLoadingState(true);

        try {
            const response = await fetch(this.form.action, {
                method: this.form.method,
                body: formData,
                headers: { 
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
            });

            if (response.ok) {
                this.showMessage("contact_success", "green");
                this.form.reset();
            } else {
                this.showMessage("contact_error", "red");
            }
        } catch (error) {
            this.showMessage("contact_network_error", "red");
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Valida los campos del formulario
     * @param {string} name - Nombre
     * @param {string} email - Email
     * @param {string} message - Mensaje
     * @returns {boolean} True si la validación es exitosa
     */
    validateForm(name, email, message) {
        if (!name.trim() || !email.trim() || !message.trim()) {
            this.showMessage("contact_required", "red");
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showMessage("contact_email_invalid", "red");
            return false;
        }

        return true;
    }

    /**
     * Valida formato de email
     * @param {string} email - Email a validar
     * @returns {boolean} True si el email es válido
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Establece estado de carga del formulario
     * @param {boolean} isLoading - Si está cargando
     */
    setLoadingState(isLoading) {
        const submitButton = this.form.querySelector('button[type="submit"]');
        
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.innerHTML = this.i18n.lang === "es" ? 
                '<i class="fas fa-spinner fa-spin"></i> Enviando...' : 
                '<i class="fas fa-spinner fa-spin"></i> Sending...';
        } else {
            submitButton.disabled = false;
            submitButton.textContent = this.i18n.translate("contact_send");
        }
    }

    /**
     * Muestra mensaje de estado
     * @param {string} key - Clave de traducción
     * @param {string} color - Color del mensaje ('green', 'red')
     */
    showMessage(key, color) {
        this.status.textContent = this.i18n.translate(key);
        this.status.style.color = `var(--${color}-color)`;
        
        this.status.className = '';
        this.status.classList.add(color);
        
        // Auto-ocultar mensaje después de 5 segundos
        setTimeout(() => {
            this.status.textContent = '';
            this.status.className = '';
        }, 5000);
    }
}

/**
 * 🚀 APP - Clase principal de la aplicación
 * Coordina todos los componentes y maneja la inicialización
 */
class App {
    /**
     * @constructor
     */
    constructor() {
        /** @type {Object} Configuración cargada */
        this.config = null;
        /** @type {I18n} Instancia de internacionalización */
        this.i18n = null;
        /** @type {ThemeManager} Instancia de tema */
        this.theme = null;
        /** @type {ProjectLoader} Instancia de cargador de proyectos */
        this.projectLoader = null;
        /** @type {ContactForm} Instancia de formulario de contacto */
        this.contactForm = null;

        this.init();
    }

    /**
     * Inicializa la aplicación
     * @async
     */
    async init() {
        try {
            // Cargar configuración persistente
            this.config = ConfigManager.load();
            
            // Aplicar configuración visual inmediatamente
            this.applyInitialConfig();
            
            // Inicializar componentes
            await this.initComponents();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Marcar como cargado
            this.markAsLoaded();
            
        } catch (error) {
            console.error('Error inicializando aplicación:', error);
            this.showErrorState();
        }
    }

    /**
     * Aplica configuración inicial para evitar flashes
     */
    applyInitialConfig() {
        // Aplicar tema inmediatamente
        const isDark = this.config.theme === 'dark' || 
                      (this.config.theme === 'auto' && 
                       window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", isDark);
        
        // Aplicar texto inicial de botón de idioma
        const langBtn = document.getElementById("lang-switch");
        langBtn.textContent = this.config.language === "es" ? "EN" : "ES";
    }

    /**
     * Inicializa todos los componentes
     * @async
     */
    async initComponents() {
        this.i18n = new I18n(this.config.language);
        this.theme = new ThemeManager(this.i18n);
        this.projectLoader = new ProjectLoader(this.config.language, this.config.filters);
        this.contactForm = new ContactForm(this.i18n);
        
        // Esperar a que las traducciones estén cargadas
        await this.i18n.loadTranslations(this.config.language);
    }

    /**
     * Configura event listeners globales
     */
    setupEventListeners() {
        // Cambio de idioma
        document.getElementById("lang-switch").addEventListener("click", () => {
            const newLang = this.i18n.lang === "es" ? "en" : "es";
            this.projectLoader.changeLanguage(newLang);
        });

        // Menú hamburguesa
        this.setupMobileMenu();
    }

    /**
     * Configura el menú móvil
     */
    setupMobileMenu() {
        const menuToggle = document.getElementById("menu-toggle");
        const navMenu = document.getElementById("nav-menu");
        const navLinks = navMenu.querySelectorAll("a");
        
        menuToggle.addEventListener("click", () => {
            navMenu.classList.toggle("active");
            menuToggle.textContent = navMenu.classList.contains("active") ? "✖" : "☰";
            menuToggle.setAttribute("aria-expanded", navMenu.classList.contains("active"));
        });
        
        // Cerrar menú al hacer clic en enlaces
        navLinks.forEach(link => {
            link.addEventListener("click", () => this.closeMobileMenu());
        });
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768 && 
                navMenu.classList.contains("active") &&
                !e.target.closest("#nav-menu") && 
                !e.target.closest("#menu-toggle")) {
                this.closeMobileMenu();
            }
        });
        
        // Cerrar menú al redimensionar
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileMenu();
            }
        });
    }

    /**
     * Cierra el menú móvil
     */
    closeMobileMenu() {
        const menuToggle = document.getElementById("menu-toggle");
        const navMenu = document.getElementById("nav-menu");
        
        navMenu.classList.remove("active");
        menuToggle.textContent = "☰";
        menuToggle.setAttribute("aria-expanded", "false");
    }

    /**
     * Marca la aplicación como cargada
     */
    markAsLoaded() {
        document.body.classList.add('app-loaded');
        document.documentElement.style.visibility = 'visible';
    }

    /**
     * Muestra estado de error
     */
    showErrorState() {
        document.body.innerHTML = `
            <div class="error-state">
                <h1>😕</h1>
                <h2>Algo salió mal</h2>
                <p>No se pudo cargar la aplicación. Por favor, recarga la página.</p>
                <button onclick="window.location.reload()">Reintentar</button>
            </div>
        `;
    }

    /**
     * Limpia todos los recursos
     */
    destroy() {
        if (this.projectLoader) {
            this.projectLoader.destroy();
        }
        
        // Limpiar event listeners
        const cleanNode = (node) => {
            const newNode = node.cloneNode(false);
            node.parentNode.replaceChild(newNode, node);
            return newNode;
        };
        
        cleanNode(document.getElementById("lang-switch"));
        cleanNode(document.getElementById("theme-toggle"));
        cleanNode(document.getElementById("project-filters"));
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    // Aplicar estilos de carga inicial
    document.documentElement.style.visibility = 'hidden';
    
    // Inicializar aplicación
    window.app = new App();


    // Referencias a elementos del DOM
      const accessibilityBtn = document.querySelector('.accessibility-btn');
      const accessibilityContent = document.querySelector('.accessibility-content');
      const fontSizeBtns = document.querySelectorAll('.font-size-btn');
      const contrastBtns = document.querySelectorAll('.contrast-btn');
      const readBtn = document.getElementById('read-content');
      
      // Cargar configuración guardada
      loadAccessibilitySettings();
      
      // Alternar visibilidad del panel
      accessibilityBtn.addEventListener('click', function() {
        accessibilityContent.classList.toggle('show');
      });
      
      // Cerrar panel al hacer clic fuera
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.accessibility-panel')) {
          accessibilityContent.classList.remove('show');
        }
      });
      
      // Control de tamaño de fuente
      fontSizeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const size = this.dataset.size;
          
          // Remover clases existentes
          document.documentElement.classList.remove('font-small', 'font-large', 'font-x-large');
          
          // Aplicar nueva clase según la selección
          if (size !== 'normal') {
            document.documentElement.classList.add(`font-${size}`);
          }
          
          // Actualizar estado visual de botones
          fontSizeBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          
          // Guardar preferencia
          saveSetting('fontSize', size);
        });
      });
      
      // Control de contraste
      contrastBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const contrast = this.dataset.contrast;
          
          // Alternar clase de alto contraste
          if (contrast === 'high') {
            document.documentElement.classList.add('high-contrast');
          } else {
            document.documentElement.classList.remove('high-contrast');
          }
          
          // Actualizar estado visual de botones
          contrastBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          
          // Guardar preferencia
          saveSetting('highContrast', contrast === 'high');
        });
      });
      
      // Control de lectura
      let isReading = false;
      let speech = null;
      
      readBtn.addEventListener('click', function() {
        if (isReading) {
          stopReading();
        } else {
          startReading();
        }
      });
      
      function startReading() {
        if ('speechSynthesis' in window) {
          // Obtener todo el texto de la página (puedes ajustar los selectores según necesites)
          const pageContent = document.body.innerText;
          
          // Crear objeto de síntesis de voz
          speech = new SpeechSynthesisUtterance(pageContent);
          speech.lang = document.documentElement.lang || 'es-ES';
          speech.rate = 0.9;
          
          // Evento para resaltar texto mientras se lee
          let charIndex = 0;
          speech.addEventListener('boundary', function(e) {
            // Esta implementación es básica, podrías mejorarla
            // para resaltar el texto que se está leyendo actualmente
            highlightReadingText(charIndex, e.charIndex);
            charIndex = e.charIndex;
          });
          
          // Iniciar lectura
          window.speechSynthesis.speak(speech);
          isReading = true;
          readBtn.textContent = 'Detener lectura';
          readBtn.classList.add('reading');
        } else {
          alert('Tu navegador no soporta la función de lectura en voz alta.');
        }
      }
      
      function stopReading() {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        isReading = false;
        readBtn.textContent = 'Leer contenido';
        readBtn.classList.remove('reading');
        
        // Quitar resaltados
        removeReadingHighlights();
      }
      
      function highlightReadingText(startIndex, endIndex) {
        // Esta función necesitaría una implementación más sofisticada
        // para encontrar y resaltar el texto exacto que se está leyendo
        removeReadingHighlights();
        
        // Implementación básica: resaltar párrafos completos
        // En una implementación real, necesitarías un algoritmo más complejo
        document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li').forEach(el => {
          el.classList.add('reading-highlight');
        });
      }
      
      function removeReadingHighlights() {
        document.querySelectorAll('.reading-highlight').forEach(el => {
          el.classList.remove('reading-highlight');
        });
      }
      
      // Guardar configuración en localStorage
      function saveSetting(key, value) {
        const settings = JSON.parse(localStorage.getItem('accessibilitySettings') || '{}');
        settings[key] = value;
        localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
      }
      
      // Cargar configuración desde localStorage
      function loadAccessibilitySettings() {
        const settings = JSON.parse(localStorage.getItem('accessibilitySettings') || '{}');
        
        // Aplicar configuración de tamaño de fuente
        if (settings.fontSize && settings.fontSize !== 'normal') {
          document.documentElement.classList.add(`font-${settings.fontSize}`);
          document.querySelector(`.font-size-btn[data-size="${settings.fontSize}"]`).classList.add('active');
          document.querySelector('.font-size-btn[data-size="normal"]').classList.remove('active');
        }
        
        // Aplicar configuración de contraste
        if (settings.highContrast) {
          document.documentElement.classList.add('high-contrast');
          document.querySelector('.contrast-btn[data-contrast="high"]').classList.add('active');
          document.querySelector('.contrast-btn[data-contrast="normal"]').classList.remove('active');
        }
      }
    });
