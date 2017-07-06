/**
 * The fs2mod object is defined through python. The methods are implemented in knossos/web.py.
 */

function init() {
    let task_mod_map = {};

    function call(ref) {
        let args = Array.prototype.slice.apply(arguments, [1]);
        
        if(window.qt) {
            ref.apply(null, args);
        } else {
            let cb = args.pop();
            cb(ref.apply(null, args));
        }
    }

    function connectOnce(sig, cb) {
        let wrapper = function () {
            sig.disconnect(wrapper);
            return cb.apply(this, arguments);
        };
        sig.connect(wrapper);
    }

    // Make sure we never reach load_left <= 0 until load_cb is declared.
    let load_left = 1;
    function registerComp(name, options) {
        load_left++;
        call(fs2mod.loadTemplate, name, (res) => {
            options.template = res;
            Vue.component(name, options);

            load_left--;
            if(load_left <= 0) load_cb();
        });
    }

    registerComp('kn-mod', {
        props: ['mod', 'tab'],

        methods: {
            showDetails() {
                vm.mod = this.mod;
                vm.page = 'details';
            }
        }
    });

    registerComp('kn-mod-buttons', {
        props: ['mod', 'tab'],

        methods: {
            play() {
                fs2mod.runMod(this.mod.id, '');
            },

            update() {
                fs2mod.updateMod(this.mod.id, '');
            },

            install() {
                fs2mod.install(this.mod.id, '', []);
            },

            uninstall() {
                fs2mod.uninstall(this.mod.id, '', []);
            },

            cancel() {
                fs2mod.abortTask(task_mod_map[this.mod.id]);
            },

            showErrors() {
                vm.popup_content = this.mod;
                vm.popup_title = 'Mod errors';
                vm.popup_mode = 'mod_errors';
                vm.popup_visible = true;
            },

            showProgress() {
                vm.popup_content = this.mod;
                vm.popup_title = 'Installation Details';
                vm.popup_mode = 'mod_progress';
                vm.popup_visible = true;
            }
        }
    });

    registerComp('kn-drawer', {
        props: ['label'],

        data: () => ({
            open: false
        })
    });

    registerComp('kn-settings-page', {
        props: [],

        data: () => ({
            knossos: {},
            fso: {},
            old_settings: {},
            default_fs2_bin: null,
            default_fred_bin: null,
            caps: null
        }),

        beforeMount() {
            connectOnce(fs2mod.settingsArrived, (settings) => {
                settings = JSON.parse(settings);

                this.knossos = Object.assign({}, settings.knossos);
                this.fso = Object.assign({}, settings.fso);
                this.old_settings = settings;
                this.default_fs2_bin = settings.knossos.fs2_bin;
                this.default_fred_bin = settings.knossos.fred_bin;
            });
            fs2mod.getSettings();
            call(fs2mod.getDefaultFsoCaps, (caps) => {
                this.caps = JSON.parse(caps);
            });
        },

        methods: {
            changeBasePath() {
                call(fs2mod.browseFolder, 'Please select a folder', this.knossos.base_path || '', (path) => {
                    if(path) this.knossos.base_path = path;
                });
            },

            save() {
                for(let set of ['base_path', 'max_downloads', 'use_raven']) {
                    if(this.knossos[set] != this.old_settings.knossos[set]) {
                        fs2mod.saveSetting(set, JSON.stringify(this.knossos[set]));
                    }
                }

                let fso = Object.assign({}, this.fso);
                for(let key of Object.keys(this.old_settings.fso)) {
                    if(!fso[key]) fso[key] = this.old_settings.fso[key];
                }

                fs2mod.saveFsoSettings(JSON.stringify(fso));
            }
        },

        watch: {
            default_fs2_bin(new_bin) {
                if(this.default_fs2_bin === null) return;

                call(fs2mod.saveSetting, 'fs2_bin', JSON.stringify(new_bin), () => {
                    call(fs2mod.getDefaultFsoCaps, (caps) => {
                        this.caps = JSON.parse(caps);
                    });
                });
            },

            default_fred_bin(new_bin) {
                if(this.default_fred_bin === null) return;

                fs2mod.saveSetting('fred_bin', JSON.stringify(new_bin));
            }
        }
    });

    registerComp('flag-editor', {
        props: ['caps', 'cmdline'],

        data: () => ({
            easy_flags: {},
            flags: {},
            selected_easy_flags: '',
            custom_flags: '',
            bool_flags: {},
            list_type: 'Graphics'
        }),

        methods: {
            processCmdline() {
                console.log(this);
                if(!this.caps) return;

                const flags = {};
                const custom = [];
                for(let part of this.cmdline.split(' ')) {
                    if(this.caps.flags[part]) {
                        flags[part] = true;
                    } else {
                        custom.push(part);
                    }
                }

                this.easy_flags = this.caps.easy_flags;
                this.flags = this.caps.flags;
                this.selected_easy_flags = '';
                this.custom_flags = custom.join(' ');
                this.bool_flags = flags;
                this.list_type = 'Audio';
            },

            showFlagDoc(url) {
                vm.popup_visible = true;
                vm.popup_mode = 'frame';
                vm.popup_title = 'Flag Documentation';
                vm.popup_content = url;
            }
        },

        watch: {
            caps() {
                this.processCmdline();
            }
        }
    });

    registerComp('kn-devel-page', {
        props: ['mods'],

        data: () => ({
            selected_mod: null
        }),

        methods: {
            openModFolder() {
                fs2mod.openExternal('file://' + this.selected_mod.folder);
            },

            openCreatePopup() {
                vm.popup_mode = 'create_mod';
                vm.popup_title = 'Create mod';
                vm.popup_visible = true;
            }
        }
    });

    let vm;
    function load_cb() {
        call(fs2mod.loadTemplate, 'kn-page', (tpl) => {
            window.vm = vm = new Vue({
                el: '#loading',
                template: tpl,

                data: {
                    tabs: {
                        home: 'Home',
                        explore: 'Explore',
                        develop: 'Development'
                    },

                    search_text: '',
                    tab: 'home',
                    page: 'modlist',
                    show_filter: false,
                    mods: [],

                    // welcome page
                    data_path: '?',

                    // details page
                    mod: null,

                    popup_visible: false,
                    popup_title: 'Popup',
                    popup_mode: '',
                    popup_content: null,

                    popup_mod_name: '',
                    popup_mod_id: '',
                    popup_mod_version: '1.0',
                    popup_mod_type: 'mod',
                    popup_mod_parent: 'FS2',

                    // retail prompt
                    retail_searching: true,
                    retail_found: false,
                    retail_data_path: ''
                },

                watch: {
                    search_text(phrase) {
                        fs2mod.triggerSearch(phrase);
                    }
                },

                methods: {
                    openLink(url) {
                        fs2mod.openExternal(url);
                    },

                    showHelp() {
                        alert('Not yet implemented! Sorry.');
                    },

                    updateList() {
                        fs2mod.fetchModlist();
                    },

                    showSettings() {
                        this.page = 'settings';
                    },

                    showTab(tab) {
                        fs2mod.showTab(tab);
                    },

                    exitDetails() {
                        this.page = 'modlist';
                    },

                    selectFolder() {
                        call(fs2mod.browseFolder, 'Please select a folder', this.data_path, (path) => {
                            if(path) this.data_path = path;
                        });
                    },

                    finishWelcome() {
                        fs2mod.setBasePath(this.data_path);
                    },

                    installMod() {
                        fs2mod.install(this.mod.id, '', []);
                    },

                    uninstallMod() {
                        fs2mod.uninstall(this.mod.id, '', []);
                    },

                    cancelMod() {
                        fs2mod.abortTask(task_mod_map[this.mod.id]);
                    },

                    playMod() {
                        fs2mod.runMod(this.mod.id, '');
                    },

                    updateMod() {
                        fs2mod.updateMod(this.mod.id, '');
                    },

                    createMod() {
                        call(fs2mod.createMod, this.popup_mod_name, this.popup_mod_id, this.popup_mod_version, this.popup_mod_type, this.popup_mod_parent, (result) => {
                            if(result) {
                                this.popup_visible = false;
                            }
                        });
                    },

                    showModErrors() {
                        vm.popup_content = this.mod;
                        vm.popup_title = 'Mod errors';
                        vm.popup_mode = 'mod_errors';
                        vm.popup_visible = true;
                    },

                    showModProgress() {
                        vm.popup_content = this.mod;
                        vm.popup_title = 'Installation Details';
                        vm.popup_mode = 'mod_progress';
                        vm.popup_visible = true;
                    },

                    retailAutoDetect() {
                        vm.retail_searching = true;
                        vm.retail_found = false;

                        call(fs2mod.searchRetailData, (path) => {
                            vm.retail_searching = false;

                            if(path !== '') {
                                vm.retail_found = true;
                                vm.retail_data_path = path;
                            }
                        });
                    },

                    selectRetailFolder() {
                        call(fs2mod.browseFolder, 'Please select your FS2 folder', this.retail_data_path, (path) => {
                            if(path) this.retail_data_path = path;
                        });
                    },

                    finishRetailPrompt() {
                        call(fs2mod.copyRetailData, this.retail_data_path, (result) => {
                            if(result) vm.popup_visible = false;
                        });
                    }
                }
            });

            call(fs2mod.finishInit, get_translation_source(), (t) => vm.trans = t);
        });
    }
    let mod_table = null;

    // Now that load_cb() is declared, we can subtract one from load_left thus making load_left <= 0 possible.
    load_left--;
    if(load_left == 0) {
        // All pending load requests are finished which means we can call load_cb() immediately.
        load_cb();
    }

    fs2mod.showWelcome.connect(() => vm.page = 'welcome');
    fs2mod.showDetailsPage.connect((mod) => {
        vm.mod = mod;
        vm.page = 'details';
    });
    fs2mod.showRetailPrompt.connect(() => {
        vm.popup_mode = 'retail_prompt';
        vm.popup_title = 'Retail data missing';
        vm.popup_visible = true;

        vm.retail_data_path = '';
        vm.retailAutoDetect();
    });
    fs2mod.updateModlist.connect((mods, type) => {
        window.mt = mod_table = {};
        mods = JSON.parse(mods);
        for(let mod of mods) {
            mod_table[mod.id] = mod;
        }

        vm.mods = mods;
        vm.page = type === 'develop' ? 'develop' : 'modlist';
        vm.tab = type;
    });

    let tasks = null;
    call(fs2mod.getRunningTasks, (tasks) => {
        tasks = JSON.parse(tasks);
    });

    fs2mod.taskStarted.connect((tid, title, mods) => {
        if(!tasks) return;

        tasks[tid] = { title, mods };

        for(let mid of mods) {
            if(mod_table[mid]) {
                mod_table[mid].status = 'updating';
                task_mod_map[mid] = tid;
            }
        }
    });

    fs2mod.taskProgress.connect((tid, progress, details) => {
        if(!tasks) return;

        details = JSON.parse(details);
        for(let mid of tasks[tid].mods) {
            if(mod_table[mid]) {
                mod_table[mid].progress = progress;
                mod_table[mid].progress_info = details;
            }
        }
    });

    fs2mod.taskFinished.connect((tid) => {
        if(!tasks) return;

        for(let mid of tasks[tid].mods) {
            if(mod_table[mid]) {
                mod_table[mid].progress = 0;
                mod_table[mid].status = 'ready';
            }

            if(task_mod_map[mid]) delete task_mod_map[mid];
        }

        delete tasks[tid];
    });
}

if(window.qt) {
    new QWebChannel(qt.webChannelTransport, function (channel) {
        window.fs2mod = channel.objects.fs2mod;
        init();
    });
} else {
    window.addEventListener('load', init);
}
