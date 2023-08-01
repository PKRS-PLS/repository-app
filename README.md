# repository-app
Repository principal de l'application PKRSPLS


Le fichier liste_app.txt contient la liste des applications ainsi que l'extention (.exe, .Appx, .Msix) qui peuvent être installées. Il est téléchargé puis analysé par le script à chaque lancement.

Le dossier exe contient les installeurs portables .exe qui doivent être lancés et qui ont une interface graphique.

Le dossier appx contient les fichiers d'installations .Appx qui doivent être installés en mode sous-marin par le script python grâce à une commande powershell

Le dossier msix fonctionne pareil que les .Appx, c'est juste un autre type d'extension

Le script python_install.bat permet d'installer python sur les ordis en mode sous-marin pour pouvoir ensuite lancer le script principal
