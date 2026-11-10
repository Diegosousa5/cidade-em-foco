package br.edu.cidadeemfoco.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.locationtech.jts.geom.Point;

import java.time.Instant;

@Entity
@Table(name = "ocorrencias", schema = "public")
public class Ocorrencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "titulo", nullable = false, length = 120)
    private String titulo;

    @Column(name = "descricao", nullable = false, columnDefinition = "text")
    private String descricao;

    @Column(name = "categoria", nullable = false, length = 40)
    private String categoria;

    @Column(name = "endereco", nullable = false, length = 255)
    private String endereco;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "aberto";

    @Column(name = "data_criacao", nullable = false)
    private Instant dataCriacao;

    @Column(name = "localizacao", nullable = false, columnDefinition = "geometry(Point,4326)")
    private Point localizacao;

    protected Ocorrencia() {
    }

    public Ocorrencia(
        String titulo,
        String descricao,
        String categoria,
        String endereco,
        Instant dataCriacao,
        Point localizacao
    ) {
        this.titulo = titulo;
        this.descricao = descricao;
        this.categoria = categoria;
        this.endereco = endereco;
        this.dataCriacao = dataCriacao;
        this.localizacao = localizacao;
    }

    public Long getId() {
        return id;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getEndereco() {
        return endereco;
    }

    public void setEndereco(String endereco) {
        this.endereco = endereco;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getDataCriacao() {
        return dataCriacao;
    }

    public void setDataCriacao(Instant dataCriacao) {
        this.dataCriacao = dataCriacao;
    }

    public Point getLocalizacao() {
        return localizacao;
    }

    public void setLocalizacao(Point localizacao) {
        this.localizacao = localizacao;
    }
}
